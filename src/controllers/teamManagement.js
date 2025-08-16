import {
  addTeamMemberService,
  updateTeamMemberService,
  deleteTeamMemberService,
  getAllTeamMembersService,
  getTeamMemberByIdService
} from '../services/teamManagementService.js';

export const addTeamMember = async (req, res, next) => {
  try {
    const data = req.body;

    const result = await addTeamMemberService(data);

    res.status(200).json({
        success: true,
        message: 'Team member added successfully',
        data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getTeamMemberById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await getTeamMemberByIdService(id);
    res.status(200).json({
        success: true,
        message: 'Team member fetched successfully',
        teamMember: result
    });
  } catch (error) {
    next(error);
  }
};

export const updateTeamMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const result = await updateTeamMemberService(data, id);
    res.status(200).json({
        success: true,
        message: 'Team member updated successfully',
        data: result
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTeamMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await deleteTeamMemberService(id);
    res.status(200).json({
        success: true,
        message: 'Team member deleted successfully',
        data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getAllTeamMembers = async (req, res, next) => {
  try {
    const result = await getAllTeamMembersService();

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
