/*!
 Copyright (C) 2017 Google Inc.
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 */

(function (can, GGRC) {
  'use strict';

  var template = can.view(GGRC.mustache_path +
    '/components/advanced-search/advanced-search-filter-group.mustache');

  /**
   * Filter Group view model.
   * Contains logic used in Filter Group component
   * @constructor
   */
  var viewModel = GGRC.VM.AdvancedSearchContainer.extend({
    /**
     * Contains available attributes for specific model.
     * @type {can.List}
     */
    availableAttributes: can.List(),
    /**
     * Adds Filter Operator and Filter Attribute to the collection.
     */
    addFilterCriterion: function () {
      var items = this.attr('items');
      items.push(GGRC.Utils.AdvancedSearch.create.operator('AND'));
      items.push(GGRC.Utils.AdvancedSearch.create.attribute());
    }
  });

  /**
   * Filter Group is a component allowing to compose Filter Attributes and Operators.
   */
  GGRC.Components('advancedSearchFilterGroup', {
    tag: 'advanced-search-filter-group',
    template: template,
    viewModel: viewModel
  });
})(window.can, window.GGRC);
