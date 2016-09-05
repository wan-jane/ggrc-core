/*!
    Copyright (C) 2016 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (GGRC, CMS, can) {
  var Proxy = GGRC.MapperHelpers.Proxy;
  var Direct = GGRC.MapperHelpers.Direct;
  var Indirect = GGRC.MapperHelpers.Indirect;
  var Search = GGRC.MapperHelpers.Search;
  var Multi = GGRC.MapperHelpers.Multi;
  var TypeFilter = GGRC.MapperHelpers.TypeFilter;
  var AttrFilter = GGRC.MapperHelpers.AttrFilter;
  var CustomFilter = GGRC.MapperHelpers.CustomFilter;
  var Cross = GGRC.MapperHelpers.Cross;
  /*
    class GGRC.Mappings
    represents everything known about how GGRC objects connect to each other.

    a Mappings instance contains the set of known mappings for a module, such as "ggrc_core"
    or "ggrc_gdrive_integration".  The set of all Mappings instances is used throughout the
    system to build widgets, map and unmap objects, etc.

    To configure a new Mappings instance, use the following format :
    { <mixin name or source object type> : {
        _mixins : [ <mixin name>, ... ],
        _canonical : { <option type> : <name of mapping in parent object>, ... }
        <mapping name> : GGRC.Mappings.Proxy(...) | GGRC.Mappings.Direct(...) | GGRC.Mappings.Indirect(...)
                        | GGRC.Mappings.Multi(...) | GGRC.Mappings.TypeFilter(...) | GGRC.Mappings.Cross(...)
                        | GGRC.Mappings.CustomFilter(...),
        ...
      }
    }
  */
  can.Construct('GGRC.Mappings', {
    // Convenience properties for building mappings types.
    Proxy: Proxy,
    Direct: Direct,
    Indirect: Indirect,
    Search: Search,
    Multi: Multi,
    TypeFilter: TypeFilter,
    AttrFilter: AttrFilter,
    CustomFilter: CustomFilter,
    Cross: Cross,
    modules: {},

    /*
      return all mappings from all modules for an object type.
      object - a string representing the object type's shortName

      return: a keyed object of all mappings (instances of GGRC.ListLoaders.BaseListLoader) by mapping name
      Example: GGRC.Mappings.get_mappings_for('Program')
    */
    get_mappings_for: function (object) {
      var mappings = {};
      can.each(this.modules, function (mod, name) {
        if (mod[object]) {
          can.each(mod[object], function (mapping, mappingName) {
            if (mappingName === '_canonical')
              return;
            mappings[mappingName] = mapping;
          });
        }
      });
      return mappings;
    },
    /*
      return the canonical mapping (suitable for joining) between two objects.
      object - the string type (shortName) of the "from" object's class
      option - the string type (shortName) of the "to" object's class

      return: an instance of GGRC.ListLoaders.BaseListLoader (mappings are implemented as ListLoaders)
    */
    get_canonical_mapping: function (object, option) {
      var mapping = null;
      can.each(this.modules, function (mod, name) {
        if (mod._canonical_mappings && mod._canonical_mappings[object] &&
          mod._canonical_mappings[object][option]) {
          mapping =
            CMS.Models[object]
              .get_mapper(mod._canonical_mappings[object][option]);
          return false;
        }
      });
      return mapping;
    },
    /*
      return the defined name of the canonical mapping between two objects.
      object - the string type (shortName) of the "from" object's class
      option - the string type (shortName) of the "to" object's class

      return: an instance of GGRC.ListLoaders.BaseListLoader (mappings are implemented as ListLoaders)
    */
    get_canonical_mapping_name: function (object, option) {
      var mappingName = null;
      can.each(this.modules, function (mod, name) {
        if (mod._canonical_mappings && mod._canonical_mappings[object] &&
          mod._canonical_mappings[object][option]) {
          mappingName = mod._canonical_mappings[object][option];
          return false;
        }
      });
      return mappingName;
    },
    /*
      return all canonical mappings (suitable for joining) from all modules for an object type.
      object - a string representing the object type's shortName

      return: a keyed object of all mappings (instances of GGRC.ListLoaders.BaseListLoader) by option type
    */
    get_canonical_mappings_for: function (object) {
      var mappings = {};
      can.each(this.modules, function (mod, name) {
        if (mod._canonical_mappings && mod._canonical_mappings[object]) {
          can.each(mod._canonical_mappings[object],
            function (mappingName, option) {
              mappings[option] = CMS.Models[object].get_mapper(mappingName);
            });
        }
      });
      return mappings;
    },
    /*
      return the join model for the canonical mapping between two objects if and only if the canonical mapping is a Proxy.
      model_name_a - the string type (shortName) of the "from" object's class
      model_name_b - the string type (shortName) of the "to" object's class

      return: a string of the shortName of the join model (subclass of can.Model.Join) or null
    */
    join_model_name_for: function (modelNameA, modelNameB) {
      var joinDescriptor = this.get_canonical_mapping(modelNameA, modelNameB);
      var result;
      if (joinDescriptor instanceof GGRC.ListLoaders.ProxyListLoader) {
        result = joinDescriptor.model_name;
      } else {
        result = null;
      }
      return result;
    },
    /*
      make a new instance of the join model for the canonical mapping between two objects
       if and only if the canonical mapping is a Proxy.
      object - the string type (shortName) of the "from" object's class
      option - the string type (shortName) of the "to" object's class
      join_attrs - any other attributes to add to the new instance

      return: an instance of the join model (subclass of can.Model.Join) or null
    */
    make_join_object: function (object, option, joinAttrs) {
      var joinModel;
      var joinMapping = this.get_canonical_mapping(object.constructor.shortName,
        option.constructor.shortName);
      var objectAttrs = {
        id: object.id,
        type: object.constructor.shortName
      };
      var optionAttrs = {
        id: option.id,
        type: option.constructor.shortName
      };
      var result;

      if (joinMapping && joinMapping.model_name) {
        joinModel = CMS.Models[joinMapping.model_name];
        joinAttrs = $.extend({}, joinAttrs || {});
        joinAttrs[joinMapping.option_attr] = optionAttrs;
        joinAttrs[joinMapping.object_attr] = objectAttrs;

        result = new joinModel(joinAttrs);
      } else {
        result = null;
      }
      return result;
    }
  }, {
    /*
      On init:
      kick off the application of mixins to the mappings and resolve canonical mappings
    */
    init: function (name, opts) {
      var createdMappings;
      var that = this;
      this.constructor.modules[name] = this;
      this._canonical_mappings = {};
      if (this.groups) {
        can.each(this.groups, function (group, name) {
          if (typeof group === 'function') {
            that.groups[name] = $.proxy(group, that.groups);
          }
        });
      }
      createdMappings = this.create_mappings(opts);
      can.each(createdMappings, function (mappings, objectType) {
        if (mappings._canonical) {
          if (!that._canonical_mappings[objectType]) {
            that._canonical_mappings[objectType] = {};
          }

          can.each(mappings._canonical || [],
            function (optionTypes, mappingName) {
              if (!can.isArray(optionTypes)) {
                optionTypes = [optionTypes];
              }
              can.each(optionTypes, function (optionType) {
                that._canonical_mappings[objectType][optionType] = mappingName;
              });
            });
        }
      });
      $.extend(this, createdMappings);
    },
    // Recursively handle mixins -- this function should not be called directly.
    reify_mixins: function (definition, definitions) {
      var that = this;
      var finalDefinition = {};
      if (definition._mixins) {
        can.each(definition._mixins, function (mixin) {
          if (typeof (mixin) === 'string') {
            // If string, recursive lookup
            if (!definitions[mixin]) {
              console.debug('Undefined mixin: ' + mixin, definitions);
            } else {
              can.extend(true, finalDefinition,
                that.reify_mixins(definitions[mixin], definitions));
            }
          } else if (can.isFunction(mixin)) {
            // If function, call with current definition state
            mixin(finalDefinition);
          } else {
            // Otherwise, assume object and extend
            if (finalDefinition._canonical && mixin._canonical) {
              mixin = can.extend({}, mixin);

              can.each(mixin._canonical, function (types, mapping) {
                if (finalDefinition._canonical[mapping]) {
                  if (!can.isArray(finalDefinition._canonical[mapping])) {
                    finalDefinition._canonical[mapping] =
                      [finalDefinition._canonical[mapping]];
                  }
                  finalDefinition._canonical[mapping] =
                    can.unique(finalDefinition._canonical[mapping]
                      .concat(types));
                } else {
                  finalDefinition._canonical[mapping] = types;
                }
              });
              finalDefinition._canonical = can.extend({}, mixin._canonical,
                finalDefinition._canonical);
              delete mixin._canonical;
            }
            can.extend(finalDefinition, mixin);
          }
        });
      }
      can.extend(true, finalDefinition, definition);
      delete finalDefinition._mixins;
      return finalDefinition;
    },

    // create mappings for definitions -- this function should not be called directly/
    create_mappings: function (definitions) {
      var mappings = {};

      can.each(definitions, function (definition, name) {
        // Only output the mappings if it's a model, e.g., uppercase first letter
        if (name[0] === name[0].toUpperCase())
          mappings[name] = this.reify_mixins(definition, definitions);
      }, this);
      return mappings;
    }
  });

  new GGRC.Mappings('ggrc_core', {
    base: {},

    // Governance
    Control: {
      _mixins: ['related_object', 'personable', 'ownable'],
      related_business_objects: Multi([
        'related_data_assets', 'related_facilities', 'related_markets',
        'related_org_groups', 'related_vendors', 'related_processes',
        'related_products', 'related_projects', 'related_systems'
      ]),
      related_and_able_objects: Multi([
        'objectives', 'related_business_objects',
        'people', 'programs', 'clauses'
      ]),
      audits: Proxy(
        'Audit', 'audit', 'AuditObject', 'auditable', 'audit_objects'),
      orphaned_objects: Multi([
        'related_objects', 'clauses', 'controls', 'programs', 'objectives',
        'people'
      ])
    },
    Objective: {
      _mixins: ['related_object', 'personable', 'ownable'],
      related_and_able_objects: Multi([
        'controls', 'objectives', 'related_objects', 'people',
        'sections', 'clauses'
      ]),
      orphaned_objects: Multi([
        'related_objects', 'clauses', 'contracts', 'controls', 'objectives',
        'people', 'policies', 'programs', 'regulations', 'sections', 'standards'
      ])
    },
    Section: {
      _mixins: ['related_object', 'personable', 'ownable']
    },
    Clause: {
      _mixins: ['related_object', 'personable', 'ownable']
    },
    personable: {
      _canonical: {
        people: 'Person'
      },
      people: Proxy(
        'Person', 'person', 'ObjectPerson', 'personable', 'object_people')
    },
    ownable: {
      owners: Proxy(
        'Person', 'person', 'ObjectOwner', 'ownable', 'object_owners')
    },
    documentable: {
      _canonical: {
        documents: 'Document'
      },
      documents: Proxy(
        'Document', 'document', 'ObjectDocument', 'documentable',
        'object_documents')
    },
    assignable: {
      urls: TypeFilter('related_objects', 'Document'),
      info_related_objects: CustomFilter('related_objects',
        function (relatedObjects) {
          return !_.includes(['Comment', 'Document', 'Person'],
            relatedObjects.instance.type);
        }),
      comments: TypeFilter('related_objects', 'Comment'),
      documents_from_comments: Cross('comments', 'documents'),
      urls_from_comments: Cross('comments', 'urls'),
      all_documents: Multi(['documents', 'documents_from_comments']),
      all_urls: Multi(['urls', 'urls_from_comments'])
    },
    related_object: {
      _canonical: {
        related_objects_as_source: [
          'DataAsset', 'Facility', 'Market', 'OrgGroup', 'Vendor', 'Process',
          'Product', 'Project', 'System', 'Regulation', 'Policy', 'Contract',
          'Standard', 'Program', 'Issue', 'Control', 'Section', 'Clause',
          'Objective', 'Audit', 'Assessment', 'AssessmentTemplate',
          'AccessGroup', 'Request', 'Document'
        ]
      },
      related_objects_as_source: Proxy(
        null, 'destination', 'Relationship', 'source', 'related_destinations'),
      related_objects_as_destination: Proxy(
        null, 'source', 'Relationship', 'destination', 'related_sources'),
      related_objects:
        Multi(['related_objects_as_source', 'related_objects_as_destination']),
      destinations: Direct('Relationship', 'source', 'related_destinations'),
      sources: Direct('Relationship', 'destination', 'related_sources'),
      relationships: Multi(['sources', 'destinations']),
      related_access_groups: TypeFilter('related_objects', 'AccessGroup'),
      related_data_assets: TypeFilter('related_objects', 'DataAsset'),
      related_facilities: TypeFilter('related_objects', 'Facility'),
      related_markets: TypeFilter('related_objects', 'Market'),
      related_org_groups: TypeFilter('related_objects', 'OrgGroup'),
      related_vendors: TypeFilter('related_objects', 'Vendor'),
      related_processes: TypeFilter('related_objects', 'Process'),
      related_products: TypeFilter('related_objects', 'Product'),
      related_projects: TypeFilter('related_objects', 'Project'),
      related_systems: TypeFilter('related_objects', 'System'),
      related_issues: TypeFilter('related_objects', 'Issue'),
      related_audits: TypeFilter('related_objects', 'Audit'),
      related_controls: TypeFilter('related_objects', 'Control'),
      related_assessments: TypeFilter('related_objects', 'Assessment'),
      related_requests: TypeFilter('related_objects', 'Request'),
      regulations: TypeFilter('related_objects', 'Regulation'),
      contracts: TypeFilter('related_objects', 'Contract'),
      policies: TypeFilter('related_objects', 'Policy'),
      standards: TypeFilter('related_objects', 'Standard'),
      programs: TypeFilter('related_objects', 'Program'),
      controls: TypeFilter('related_objects', 'Control'),
      sections: TypeFilter('related_objects', 'Section'),
      clauses: TypeFilter('related_objects', 'Clause'),
      objectives: TypeFilter('related_objects', 'Objective')
    },
    // Program
    Program: {
      _mixins: [
        'related_object', 'personable'
      ],
      _canonical: {
        audits: 'Audit',
        context: 'Context'
      },
      related_issues: TypeFilter('related_objects', 'Issue'),
      audits: Direct('Audit', 'program', 'audits'),
      related_people_via_audits:
        TypeFilter('related_objects_via_audits', 'Person'),
      authorizations_via_audits: Cross('audits', 'authorizations'),
      context: Direct('Context', 'related_object', 'context'),
      contexts_via_audits: Cross('audits', 'context'),
      program_authorized_people: Cross('context', 'authorized_people'),
      program_authorizations: Cross('context', 'user_roles'),
      authorization_contexts: Multi(['context', 'contexts_via_audits']),
      authorizations_via_contexts:
        Cross('authorization_contexts', 'user_roles'),
      authorizations: Cross('authorization_contexts', 'user_roles'),
      authorized_people: Cross('authorization_contexts', 'authorized_people'),
      mapped_and_or_authorized_people: Multi([
        'people', 'authorized_people'
      ]),
      owner_authorizations: CustomFilter('program_authorizations',
        function (authBinding) {
          return new RefreshQueue()
            .enqueue(authBinding.instance.role.reify())
            .trigger()
            .then(function (roles) {
              return roles[0].name === 'ProgramOwner';
            });
        }),
      program_owners: Cross('owner_authorizations', 'person'),
      owners_via_object_owners: Proxy(
        'Person', 'person', 'ObjectOwner', 'ownable', 'object_owners'),
      owners: Multi(['program_owners', 'owners_via_object_owners']),
      orphaned_objects: Multi([
        'related_objects', 'people'
      ])
    },
    directive_object: {
      _mixins: [
        'related_object', 'personable', 'ownable'
      ],
      orphaned_objects: Multi([
        'people', 'controls', 'objectives', 'related_objects'
      ])
    },

    // Directives
    Regulation: {
      _mixins: ['directive_object']
    },
    Contract: {
      _mixins: ['directive_object']
    },
    Standard: {
      _mixins: ['directive_object']
    },
    Policy: {
      _mixins: ['directive_object']
    },

    // Business objects
    business_object: {
      _mixins: [
        'related_object', 'personable',
        'ownable'
      ],
      orphaned_objects: Multi([
        'related_objects', 'people', 'controls', 'objectives', 'sections',
        'clauses'
      ])
    },
    AccessGroup: {
      _mixins: ['business_object']
    },
    DataAsset: {
      _mixins: ['business_object']
    },
    Facility: {
      _mixins: ['business_object']
    },
    Market: {
      _mixins: ['business_object']
    },
    OrgGroup: {
      _mixins: ['business_object']
    },
    Vendor: {
      _mixins: ['business_object']
    },
    Product: {
      _mixins: ['business_object']
    },
    Project: {
      _mixins: ['business_object']
    },
    System: {
      _mixins: ['business_object']
    },
    Process: {
      _mixins: ['business_object']
    },
    Person: {
      _canonical: {
        related_objects: [
          'Program', 'Regulation', 'Contract', 'Policy', 'Standard',
          'AccessGroup', 'Objective', 'Control', 'Section', 'Clause',
          'DataAsset', 'Facility', 'Market', 'OrgGroup', 'Vendor', 'Process',
          'Product', 'Project', 'System', 'Issue',
          'Request'
        ],
        authorizations: 'UserRole'
      },
      owned_programs: Indirect('Program', 'contact'),
      owned_regulations: Indirect('Regulation', 'contact'),
      owned_contracts: Indirect('Contract', 'contact'),
      owned_policies: Indirect('Policy', 'contact'),
      owned_standards: Indirect('Standard', 'contact'),
      owned_objectives: Indirect('Objective', 'contact'),
      owned_controls: Indirect('Control', 'contact'),
      owned_sections: Indirect('Section', 'contact'),
      owned_clauses: Indirect('Clause', 'contact'),
      owned_access_groups: Indirect('AccessGroup', 'contact'),
      owned_data_assets: Indirect('DataAsset', 'contact'),
      owned_facilities: Indirect('Facility', 'contact'),
      owned_markets: Indirect('Market', 'contact'),
      owned_org_groups: Indirect('OrgGroup', 'contact'),
      owned_vendors: Indirect('Vendor', 'contact'),
      owned_processes: Indirect('Process', 'contact'),
      owned_products: Indirect('Product', 'contact'),
      owned_projects: Indirect('Project', 'contact'),
      owned_systems: Indirect('System', 'contact'),
      related_objects: Proxy(
        null, 'personable', 'ObjectPerson', 'person', 'object_people'),
      related_programs: TypeFilter('related_objects', 'Program'),
      related_regulations: TypeFilter('related_objects', 'Regulation'),
      related_contracts: TypeFilter('related_objects', 'Contract'),
      related_policies: TypeFilter('related_objects', 'Policy'),
      related_standards: TypeFilter('related_objects', 'Standard'),
      related_objectives: TypeFilter('related_objects', 'Objective'),
      related_controls: TypeFilter('related_objects', 'Control'),
      related_sections: TypeFilter('related_objects', 'Section'),
      related_clauses: TypeFilter('related_objects', 'Clause'),
      related_access_groups: TypeFilter('related_objects', 'AccessGroup'),
      related_data_assets: TypeFilter('related_objects', 'DataAsset'),
      related_facilities: TypeFilter('related_objects', 'Facility'),
      related_markets: TypeFilter('related_objects', 'Market'),
      related_org_groups: TypeFilter('related_objects', 'OrgGroup'),
      related_vendors: TypeFilter('related_objects', 'Vendor'),
      related_processes: TypeFilter('related_objects', 'Process'),
      related_products: TypeFilter('related_objects', 'Product'),
      related_projects: TypeFilter('related_objects', 'Project'),
      related_systems: TypeFilter('related_objects', 'System'),
      related_issues: TypeFilter('related_objects', 'Issue'),
      authorizations: Direct('UserRole', 'person', 'user_roles'),
      programs_via_authorizations:
        Cross('authorizations', 'program_via_context'),
      extended_related_programs: Multi(['related_programs', 'owned_programs',
          'programs_via_authorizations']),
      extended_related_regulations:
        Multi(['related_regulations', 'owned_regulations']),
      extended_related_contracts:
        Multi(['related_contracts', 'owned_contracts']),
      extended_related_policies: Multi(['related_policies', 'owned_policies']),
      extended_related_objectives:
        Multi(['related_objectives', 'owned_objectives']),
      extended_related_controls: Multi(['related_controls', 'owned_controls']),
      extended_related_sections: Multi(['related_sections', 'owned_sections']),
      extended_related_clauses: Multi(['related_clauses', 'owned_clauses']),
      extended_related_data_assets:
        Multi(['related_data_assets', 'owned_data_assets']),
      extended_related_facilities:
        Multi(['related_facilities', 'owned_facilities']),
      extended_related_markets: Multi(['related_markets', 'owned_markets']),
      extended_related_org_groups:
        Multi(['related_org_groups', 'owned_org_groups']),
      extended_related_vendors: Multi(['related_vendors', 'owned_vendors']),
      extended_related_processes:
        Multi(['related_processes', 'owned_processes']),
      extended_related_products: Multi(['related_products', 'owned_products']),
      extended_related_projects: Multi(['related_projects', 'owned_projects']),
      extended_related_systems: Multi(['related_systems', 'owned_systems']),
      related_objects_via_search: Search(function (binding) {
        var types = this.observe_types;

        // checkfor window.location
        if (/^\/objectBrowser\/?$/.test(window.location.pathname)) {
          return GGRC.Models.Search.search_for_types('', types, {})
            .pipe(function (mappings) {
              return mappings.entries;
            });
        }
        return GGRC.Models.Search.search_for_types('', types, {
          contact_id: binding.instance.id
        }).pipe(function (mappings) {
          return mappings.entries;
        });
      }, 'Program,Regulation,Contract,Policy,Standard,Section,Clause,' +
        'Objective,Control,System,Process,DataAsset,AccessGroup,Product,' +
        'Project,Facility,Market,OrgGroup,Vendor,Audit,Assessment,Request,' +
        'Issue'),
      extended_related_programs_via_search:
        TypeFilter('related_objects_via_search', 'Program'),
      extended_related_regulations_via_search:
        TypeFilter('related_objects_via_search', 'Regulation'),
      extended_related_contracts_via_search:
        TypeFilter('related_objects_via_search', 'Contract'),
      extended_related_policies_via_search:
        TypeFilter('related_objects_via_search', 'Policy'),
      extended_related_standards_via_search:
        TypeFilter('related_objects_via_search', 'Standard'),
      extended_related_objectives_via_search:
        TypeFilter('related_objects_via_search', 'Objective'),
      extended_related_controls_via_search:
        TypeFilter('related_objects_via_search', 'Control'),
      extended_related_sections_via_search:
        TypeFilter('related_objects_via_search', 'Section'),
      extended_related_clauses_via_search:
        TypeFilter('related_objects_via_search', 'Clause'),
      extended_related_access_groups_via_search:
        TypeFilter('related_objects_via_search', 'AccessGroup'),
      extended_related_data_assets_via_search:
        TypeFilter('related_objects_via_search', 'DataAsset'),
      extended_related_facilities_via_search:
        TypeFilter('related_objects_via_search', 'Facility'),
      extended_related_markets_via_search:
        TypeFilter('related_objects_via_search', 'Market'),
      extended_related_org_groups_via_search:
        TypeFilter('related_objects_via_search', 'OrgGroup'),
      extended_related_vendors_via_search:
        TypeFilter('related_objects_via_search', 'Vendor'),
      extended_related_processes_via_search:
        TypeFilter('related_objects_via_search', 'Process'),
      extended_related_products_via_search:
        TypeFilter('related_objects_via_search', 'Product'),
      extended_related_projects_via_search:
        TypeFilter('related_objects_via_search', 'Project'),
      extended_related_systems_via_search:
        TypeFilter('related_objects_via_search', 'System'),
      extended_related_audits_via_search:
        TypeFilter('related_objects_via_search', 'Audit'),
      extended_related_issues_via_search:
        TypeFilter('related_objects_via_search', 'Issue'),
      extended_related_assessment_via_search:
        TypeFilter('related_objects_via_search', 'Assessment'),
      extended_related_request_via_search:
        TypeFilter('related_objects_via_search', 'Request'),
      open_audit_requests: CustomFilter('extended_related_request_via_search',
        function (result) {
          return result.instance.status !== 'Accepted';
        }),
      all_audit_requests: Search(function (binding) {
        return CMS.Models.Request.findAll({});
      }),
      all_open_audit_requests: CustomFilter('all_audit_requests',
        function (result) {
          return result.instance.status !== 'Accepted';
        })
    },
    Context: {
      _canonical: {
        user_roles: 'UserRole',
        authorized_people: 'Person'
      },
      user_roles: Direct('UserRole', 'context', 'user_roles'),
      authorized_people: Proxy('Person', 'person', 'UserRole', 'context',
        'user_roles')
    },
    UserRole: {
      // FIXME: These should not need to be `Indirect` --
      //   `context.related_object` *should* point to the right object.
      program_via_context: Indirect('Program', 'context'),
      audit_via_context: Indirect('Audit', 'context'),
      person: Direct('Person', 'user_roles', 'person'),
      role: Direct('Role', 'user_roles', 'role')
    },
    Audit: {
      _canonical: {
        requests: 'Request',
        _program: 'Program',
        context: 'Context'

      },
      _mixins: [
        'related_object'
      ],
      requests: Direct('Request', 'audit', 'requests'),
      active_requests: CustomFilter('requests', function (result) {
        return result.instance.status !== 'Accepted';
      }),
      history: CustomFilter('requests', function (result) {
        return result.instance.status === 'Accepted';
      }),
      _program: Direct('Program', 'audits', 'program'),
      program_controls: Cross('_program', 'controls'),
      program_requests: Cross('_program', 'related_requests'),
      program_issues: Cross('_program', 'related_issues'),
      program_assessments: Cross('_program', 'related_assessments'),
      objects:
        Proxy(null, 'auditable', 'AuditObject', 'audit', 'audit_objects'),
      responses_via_requests: Cross('requests', 'related_objects'),
      related_objects_via_requests:
        Multi(['requests', 'responses_via_requests']),
      context: Direct('Context', 'related_object', 'context'),
      authorizations: Cross('context', 'user_roles'),
      authorized_program_people: Cross('_program', 'authorized_people'),
      authorized_audit_people: Cross('authorizations', 'person'),
      authorized_people:
        Multi(['authorized_audit_people', 'authorized_program_people']),
      auditor_authorizations: CustomFilter('authorizations', function (result) {
        return new RefreshQueue()
          .enqueue(result.instance.role.reify())
          .trigger()
          .then(function (roles) {
            return roles[0].name === 'Auditor';
          });
      }),
      auditors: Cross('auditor_authorizations', 'person'),
      related_owned_objects:
        CustomFilter('related_objects_via_requests', function (result) {
          var person = GGRC.page_instance() instanceof CMS.Models.Person &&
            GGRC.page_instance();
          var instance = result.instance;
          return !person ||
            (instance.attr('contact') && instance.contact.id === person.id) ||
            (instance.attr('assignee') && instance.assignee.id === person.id) ||
            (instance.attr('requestor') && instance.requestor.id === person.id);
        }),
      related_owned_requests: TypeFilter('related_owned_objects', 'Request'),
      related_mapped_objects: CustomFilter('related_objects_via_requests',
        function (result) {
          var pageInstance = GGRC.page_instance();
          var instance = result.instance;
          var res;
          var isMapped = function (responses) {
            var i;
            var j;
            var response;
            var relationships;
            var relationship;

            for (i = 0; response = responses[i]; i++) {
              //  FIXME: This avoids script errors due to stubs, but causes
              //    incorrect results.  `CustomFilter.filter_fn` should be
              //    refactored to return a deferred, and then this function
              //    should be cleaned up.
              if (!('related_sources' in response)) continue;
              relationships = new can.Observe.List()
                .concat(response.related_sources.reify(),
                  response.related_destinations.reify());
              for (j = 0; relationship = relationships[j]; j++) {
                if (relationship.source && relationship.source.reify &&
                  relationship.source.reify() === pageInstance ||
                  relationship.destination &&
                  relationship.destination.reify() === pageInstance) {
                  return true;
                }
              }
            }
            return false;
          };

          if (instance instanceof CMS.Models.Request && instance.responses) {
            res = isMapped(instance.responses.reify());
          } else {
            res = false;
          }
          return res;
        }),
      extended_related_objects: Cross('requests', 'extended_related_objects'),
      related_assessment_templates: TypeFilter(
        'related_objects', 'AssessmentTemplate')
    },
    Assessment: {
      _mixins: [
        'related_object', 'personable', 'ownable', 'documentable', 'assignable'
      ],
      audits: TypeFilter('related_objects', 'Audit'),
      related_controls: TypeFilter('related_objects', 'Control'),
      related_regulations: TypeFilter('related_objects', 'Regulation'),
      related_creators:
        AttrFilter('related_objects', 'AssigneeType', 'Creator', 'Person'),
      related_assessors:
        AttrFilter('related_objects', 'AssigneeType', 'Assessor', 'Person'),
      related_verifiers:
        AttrFilter('related_objects', 'AssigneeType', 'Verifier', 'Person'),
      people: AttrFilter('related_objects', 'AssigneeType', null, 'Person')
    },
    AssessmentTemplate: {
      _mixins: ['related_object']
    },
    Issue: {
      _mixins: [
        'related_object', 'personable', 'ownable'
      ]
    },
    Request: {
      _mixins: ['related_object', 'personable', 'ownable', 'business_object',
        'documentable', 'assignable'],
      business_objects: Multi(['related_objects', 'controls', 'documents',
        'people', 'sections', 'clauses']),
      audits: Direct('Audit', 'requests', 'audit'),
      related_controls: TypeFilter('related_objects', 'Control'),
      related_regulations:
        TypeFilter('related_objects', 'Regulation'),
      related_assignees:
        AttrFilter('related_objects', 'AssigneeType', 'Assignee', 'Person'),
      related_requesters:
        AttrFilter('related_objects', 'AssigneeType', 'Requester', 'Person'),
      related_verifiers:
        AttrFilter('related_objects', 'AssigneeType', 'Verifier', 'Person'),
      people: AttrFilter('related_objects', 'AssigneeType', null, 'Person'),
      related_objects_via_search: Search(function (binding) {
        var types = [
          'Program', 'Regulation', 'Contract', 'Policy', 'Standard',
          'Section', 'Clause', 'Objective', 'Control', 'AccessGroup',
          'System', 'Process', 'DataAsset', 'Product', 'Project', 'Facility',
          'Market', 'OrgGroup', 'Vendor', 'Audit', 'Issue', 'Assessment',
          'Request'
        ];

        // checkfor window.location
        if (/^\/objectBrowser\/?$/.test(window.location.pathname)) {
          return GGRC.Models.Search.search_for_types('', types, {})
              .pipe(function (mappings) {
                return mappings.entries;
              });
        }
        return GGRC.Models.Search.search_for_types(
            '', types, {
              contact_id: binding.instance.id
            }).pipe(function (mappings) {
              return mappings.entries;
            });
      }, 'Program,Regulation,Contract,Policy,Standard,Section,Clause,' +
        'Objective,Control,System,Process,DataAsset,AccessGroup,Product,' +
        'Project,Facility,Market,OrgGroup,Vendor,Audit,Assessment,Request')
    },
    Comment: {
      _mixins: ['related_object', 'documentable', 'ownable'],
      urls: TypeFilter('related_objects', 'Document'),
      documents_and_urls: Multi(['documents', 'urls'])
    },
    Meeting: {
      _mixins: ['personable']
    },
    MultitypeSearch: {
      _mixins: ['directive_object'],
      _canonical: {
        audits: 'Audit',
        workflows: 'Workflow'
      },
      audits: Proxy(
        'Audit', 'audit', 'MultitypeSearchJoin'),
      workflows: Proxy(
        'Workflow', 'workflow', 'MultitypeSearchJoin'),
      sections: Proxy(
        'Section', 'section', 'MultitypeSearchJoin')
    },
    AuditObject: {
      _auditable: Direct(null, null, 'auditable')
    },
    // Used by Custom Attributes widget
    CustomAttributable: {
      custom_attribute_definitions: Search(function (binding) {
        return CMS.Models.CustomAttributeDefinition.findAll({
          definition_type: binding.instance.root_object,
          definition_id: null
        });
      }, 'CustomAttributeDefinition')
    }
  });
})(window.GGRC, window.CMS, window.can);
