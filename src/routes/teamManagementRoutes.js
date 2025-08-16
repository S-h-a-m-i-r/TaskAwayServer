import express from 'express';
import { addTeamMember  , getAllTeamMembers, updateTeamMember, deleteTeamMember, getTeamMemberById } from '../controllers/teamManagement.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';



const router = express.Router();

router.use(authenticateToken);

router.get('/allMembers', 
    authorizeRoles('ADMIN'),
    getAllTeamMembers
  );

router.post('/addMember', 
    authorizeRoles('ADMIN'),
    addTeamMember
  );

router.put('/updateMember/:id', 
    authorizeRoles('ADMIN'),
    updateTeamMember
  );

router.get('/getMember/:id', 
    authorizeRoles('ADMIN'),
    getTeamMemberById
  );

router.delete('/deleteMember/:id', 
    authorizeRoles('ADMIN'),
    deleteTeamMember
  );

export default router;
