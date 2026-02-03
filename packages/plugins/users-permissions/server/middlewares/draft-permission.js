'use strict';

const { ForbiddenError } = require('@strapi/utils').errors;
const { castArray } = require('lodash/fp');
const { getService } = require('../utils');

/**
 * Middleware to validate draft access permissions
 * This should be registered in the users-permissions strategy to run after authentication
 */
module.exports = async (ctx, next) => {
  // Get the status query parameter
  const status = ctx.query?.status;

  // Only check if status=draft is requested
  if (status !== 'draft') {
    return next();
  }

  // Get the auth info which includes user and permissions
  const auth = ctx.state.auth;
  
  // If no auth, deny access to draft
  if (!auth) {
    throw new ForbiddenError('You are not allowed to access draft content');
  }

  // Get the route configuration to determine which action is being accessed
  const routeConfig = ctx.state.route?.config;
  const scopes = routeConfig?.auth?.scope ? castArray(routeConfig.auth.scope) : [];
  
  // If no scopes defined, continue (shouldn't happen with content-api routes)
  if (scopes.length === 0) {
    return next();
  }

  // Get user's role or check if public
  const user = auth.credentials;
  const roleId = user?.role?.id;
  
  let permissions;
  if (roleId) {
    // Get authenticated user's permissions
    permissions = await getService('permission').findRolePermissions(roleId);
  } else {
    // Get public role permissions
    permissions = await getService('permission').findPublicPermissions();
  }

  // Check if user has draft permission for any of the scopes
  const hasDraftPermission = scopes.some((scope) =>
    permissions.some((perm) => perm.action === scope && perm.allowDraft === true)
  );

  if (!hasDraftPermission) {
    throw new ForbiddenError('You are not allowed to access draft content');
  }

  return next();
};
