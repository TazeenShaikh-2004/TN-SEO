import { apiRequest } from "./api.js";

export const auditService = {
  runAudit(projectId) {
    return apiRequest(`/audits/${encodeURIComponent(projectId)}/run`, {
      method: "POST",
    });
  },

  getAuditHistory(projectId) {
    return apiRequest(`/audits/${encodeURIComponent(projectId)}`);
  },

  getLatestAudit(projectId) {
    return apiRequest(`/audits/${encodeURIComponent(projectId)}/latest`);
  },

  getAudit(projectId, auditId) {
    return apiRequest(
      `/audits/${encodeURIComponent(projectId)}/${encodeURIComponent(auditId)}`,
    );
  },
};

export default auditService;
