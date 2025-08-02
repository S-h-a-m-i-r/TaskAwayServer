import {
  createTaskService,
  viewTaskService,
  taskAssignService,
  taskReAssignService,
  updateTaskService,
  deleteTaskService,
  listTasksService
} from '../services/tasksService.js';
export const create = async (req, res, next) => {
  try {
    const result = await createTaskService(req.body, req.files, req.user);
    res.status(201).json({
      ...result,
      message: 'Task created Successfully'
    });
  } catch (err) {
    next(err);
  }
};

export const viewTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const result = await viewTaskService(taskId, req.user || null);
    res.status(200).json({
      ...result,
      message: 'Task retrieved Successfully'
    });
  } catch (err) {
    next(err);
  }
};

export const assignTask = async (req, res, next) => {
  // we can also get the user from token as well
  try {
    const { taskId } = req.params
    const { userId } = req.body;

    const result = await taskAssignService(taskId, userId);
    res.status(200).json({
      ...result,
      message: 'Task Assigned Successfully'
    });
  } catch (err) {
    next(err);
  }
};

export const reAssignTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { userId } = req.body;

    const result = await taskReAssignService(taskId, userId);
    res.status(200).json({
      ...result,
      message: 'Task Reassigned Successfully'
    });
  } catch (err) {
    next(err);
  }
};

export const updateTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const {updateData} = req.body;
    const result = await updateTaskService(taskId, updateData);
    res.status(200).json({
      ...result,
      message: 'Task Updated Successfully'
    });
  } catch (err) {
    next(err);
  }
};

export const deleteTask = async (req, res, next) => {
    try {
      const { taskId } = req.params;
      const result = await deleteTaskService(taskId);
      res.status(200).json({
        ...result,
        message: 'Task Deleted Successfully'
      });
    } catch (err) {
      next(err);
    }
  };


  export async function listTasks(req, res) {
    try {
      const result = await listTasksService(req.query, req.user);
      res.status(200).json({
        ...result,
        message: 'Task list fetched Successfully'
      });
    } catch (err) {
      next(err);
    }
  }