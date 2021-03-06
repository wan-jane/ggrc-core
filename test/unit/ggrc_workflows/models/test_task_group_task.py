# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

import unittest
from datetime import date
from datetime import datetime


from ggrc_workflows.models import task_group_task


class TestTaskGroupTask(unittest.TestCase):

  def test_validate_task_type(self):
    t = task_group_task.TaskGroupTask()
    self.assertRaises(ValueError, t.validate_task_type, "task_type", "helloh")
    self.assertEqual("menu", t.validate_task_type("task_type", "menu"))

  def test_validate_date(self):
    t = task_group_task.TaskGroupTask()
    self.assertEqual(date(2002, 4, 16),
                     t.validate_date('start_date', date(2, 4, 16)))
    self.assertEqual(date(2014, 7, 23),
                     t.validate_date('start_date',
                                     datetime(2014, 7, 23, 22, 5, 7)))
    self.assertEqual(date(2014, 7, 23),
                     t.validate_date('start_date',
                                     datetime(2014, 7, 23, 0, 0, 0)))

  def test_validate_start_date_decorator(self):
    t = task_group_task.TaskGroupTask()
    t.start_date = date(16, 4, 21)
    self.assertEqual(date(2016, 4, 21), t.start_date)

    t.end_date = date(2016, 4, 21)

    t.start_date = date(2015, 2, 25)
    self.assertEqual(date(2015, 2, 25), t.start_date)

    t.start_date = date(2015, 6, 17)
    self.assertEqual(date(2015, 6, 17), t.start_date)
