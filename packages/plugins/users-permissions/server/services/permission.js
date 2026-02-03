'use strict';

const PUBLIC_ROLE_FILTER = { role: { type: 'public' } };

module.exports = ({ strapi }) => ({
  /**
   * Find permissions associated to a specific role ID
   *
   * @param {number} roleID
   *
   * @return {object[]}
   */
  async findRolePermissions(roleID) {
    return strapi.db.query('plugin::users-permissions.role').load({ id: roleID }, 'permissions');
  },

  /**
   * Find permissions for the public role
   *
   * @return {object[]}
   */
  async findPublicPermissions() {
    return strapi.db.query('plugin::users-permissions.permission').findMany({
      where: PUBLIC_ROLE_FILTER,
    });
  },

  /**
   * Transform a Users-Permissions' action into a content API one
   *
   * @param {object} permission
   * @param {string} permission.action
   * @param {boolean} permission.allowDraft
   *
   * @return {{ action: string, actionParameters?: object }}
   */
  toContentAPIPermission(permission) {
    const { action, allowDraft } = permission;

    // If draft access is not allowed, add action parameters to restrict status
    const result = { action };
    
    if (allowDraft === false) {
      // Add action parameters to restrict to published content only
      result.actionParameters = {
        status: { $ne: 'draft' },
      };
    }

    return result;
  },
});
