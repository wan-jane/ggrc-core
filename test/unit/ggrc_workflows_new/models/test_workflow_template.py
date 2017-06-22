# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
"""Module contains unittests for WorkflowNew model."""
import unittest
import ddt
import mock
from ggrc_workflows_new.models import workflow_template


DAY_UNIT = u'Day'
MONTH_UNIT = u'Month'
BAD_UNIT = u'Bad Unit'
NOT_STARTED_STATUS = u'Not Started'
IN_PROGRESS_STATUS = u'In Progress'
COMPLETED_STATUS = u'Completed'
NOT_TEMPLATE_STATUS = u'Not Template'


@ddt.ddt
class TestWorkflowNew(unittest.TestCase):
  """Class contains unittests for WorkflowNew model."""
  @ddt.data(None, DAY_UNIT, MONTH_UNIT)
  def test_validate_unit_positive(self, unit):
    """Tests positive cases for WorkflowNew().validate_unit() method."""
    # Note that when WorkflowNew().unit attribute value is assigned,
    # WorkflowNew().validate_unit() method runs automatically.
    workflow = workflow_template.WorkflowTemplate()
    workflow.unit = unit
    self.assertEqual(workflow.unit, unit)

  def test_validate_unit_raises(self):
    """Tests negative case for WorkflowNew().validate_unit() method."""
    # Note that when WorkflowNew().unit attribute value is assigned,
    # WorkflowNew().validate_unit() method runs automatically.
    workflow = workflow_template.WorkflowTemplate()
    with self.assertRaises(ValueError) as err:
      workflow.unit = BAD_UNIT
      self.assertIsNone(workflow.unit)
      self.assertEqual(err.exception.message,
                       u"Invalid unit: '{}'".format(BAD_UNIT))

  @mock.patch('ggrc_workflows_new.models.workflow_new.sql.exists')
  @mock.patch('ggrc_workflows_new.models.workflow_new.db.session.query')
  @ddt.data(None, 256)
  # pylint: disable=invalid-name
  def test_validate_parent_id_positive(self, parent_id, query, _):
    """Tests positive cases for WorkflowNew().validate_parent_id() method."""
    # Note that when WorkflowNew().parent_id attribute value is assigned,
    # WorkflowNew().validate_parent_id() method runs automatically.
    query.return_value.scalar = mock.MagicMock(return_value=True)
    workflow = workflow_template.WorkflowTemplate()
    workflow.parent_id = parent_id
    self.assertEqual(workflow.parent_id, parent_id)

  @mock.patch('ggrc_workflows_new.models.workflow_new.sql.exists')
  @mock.patch('ggrc_workflows_new.models.workflow_new.db.session.query')
  def test_validate_parent_id_raises(self, query, _):
    """Tests negative case for WorkflowNew().validate_parent_id() method."""
    # Note that when WorkflowNew().parent_id attribute value is assigned,
    # WorkflowNew().validate_parent_id() method runs automatically.
    query.return_value.scalar = mock.MagicMock(return_value=False)
    bad_id = 256
    workflow = workflow_template.WorkflowTemplate()
    with self.assertRaises(ValueError) as err:
      workflow.parent_id = bad_id
      self.assertIsNone(workflow.parent_id)
      self.assertEqual(err.exception.message,
                       u"Parent workflow with id '{}' is not "
                       u"found".format(bad_id))

  @mock.patch.object(workflow_template.WorkflowTemplate, 'parent_id',
                     new_callable=mock.PropertyMock, side_effect=(None, 256))
  def test_is_template(self, _):
    """Tests WorkflowNew().is_template attribute."""
    workflow = workflow_template.WorkflowTemplate()
    self.assertEqual(workflow.is_template, True)
    self.assertEqual(workflow.is_template, False)

  @mock.patch.object(workflow_template.WorkflowTemplate, 'repeat_every',
                     new_callable=mock.PropertyMock, side_effect=(256, None))
  def test_is_recurrent(self, _):
    """Tests WorkflowNew().is_recurrent attribute."""
    workflow = workflow_template.WorkflowTemplate()
    self.assertEqual(workflow.is_recurrent, True)
    self.assertEqual(workflow.is_recurrent, False)

  @mock.patch('ggrc_workflows_new.models.workflow_new.db.session.query')
  @mock.patch.object(workflow_template.WorkflowTemplate, 'is_recurrent',
                     new_callable=mock.PropertyMock)
  @mock.patch.object(workflow_template.WorkflowTemplate, 'tasks',
                     new_callable=mock.PropertyMock)
  @mock.patch.object(workflow_template.WorkflowTemplate, 'is_template',
                     new_callable=mock.PropertyMock)
  @ddt.unpack
  @ddt.data(
      (False, None, None, None, NOT_TEMPLATE_STATUS),
      (True, [], None, None, NOT_STARTED_STATUS),
      (True, [mock.MagicMock()], True, None, IN_PROGRESS_STATUS),
      (True, [mock.MagicMock()], False, True, IN_PROGRESS_STATUS),
      (True, [mock.MagicMock()], False, False, COMPLETED_STATUS)
  )
  # pylint: disable=too-many-arguments
  def test_status(self, is_template_ret, tasks_ret, is_recurrent_ret,
                  not_finished_ct_ret, test_result,
                  is_template_attr, tasks_attr, is_recurrent_attr, query):
    """Tests WorkflowNew().status attribute."""
    is_template_attr.return_value = is_template_ret
    tasks_attr.return_value = tasks_ret
    is_recurrent_attr.return_value = is_recurrent_ret
    query.return_value.scalar = mock.MagicMock(
        return_value=not_finished_ct_ret)
    workflow = workflow_template.WorkflowTemplate()
    self.assertEqual(workflow.status, test_result)