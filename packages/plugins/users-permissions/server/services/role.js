'use strict';

const _ = require('lodash');
const { NotFoundError } = require('@strapi/utils').errors;
const { getService } = require('../utils');

module.exports = ({ strapi }) => ({
  async createRole(params) {
    if (!params.type) {
      params.type = _.snakeCase(_.deburr(_.toLower(params.name)));
    }

    const role = await strapi.db
      .query('plugin::users-permissions.role')
      .create({ data: _.omit(params, ['users', 'permissions']) });

    const createPromises = _.flatMap(params.permissions, (type, typeName) => {
      return _.flatMap(type.controllers, (controller, controllerName) => {
        return _.reduce(
          controller,
          (acc, action, actionName) => {
            const { enabled, allowDraft = false /* policy */ } = action;

            if (enabled) {
              const actionID = `${typeName}.${controllerName}.${actionName}`;

              acc.push(
                strapi.db
                  .query('plugin::users-permissions.permission')
                  .create({ data: { action: actionID, role: role.id, allowDraft } })
              );
            }

            return acc;
          },
          []
        );
      });
    });

    await Promise.all(createPromises);
  },

  async findOne(roleID) {
    const role = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { id: roleID }, populate: ['permissions'] });

    if (!role) {
      throw new NotFoundError('Role not found');
    }

    const allActions = getService('users-permissions').getActions();

    // Group by `type`.
    role.permissions.forEach((permission) => {
      const [type, controller, action] = permission.action.split('.');

      _.set(allActions, `${type}.controllers.${controller}.${action}`, {
        enabled: true,
        policy: '',
        allowDraft: permission.allowDraft || false,
      });
    });

    return {
      ...role,
      permissions: allActions,
    };
  },

  async find() {
    const roles = await strapi.db
      .query('plugin::users-permissions.role')
      .findMany({ sort: ['name'] });

    for (const role of roles) {
      role.nb_users = await strapi.db
        .query('plugin::users-permissions.user')
        .count({ where: { role: { id: role.id } } });
    }

    return roles;
  },

  async updateRole(roleID, data) {
    const role = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { id: roleID }, populate: ['permissions'] });

    if (!role) {
      throw new NotFoundError('Role not found');
    }

    await strapi.db.query('plugin::users-permissions.role').update({
      where: { id: roleID },
      data: _.pick(data, ['name', 'description']),
    });

    const { permissions } = data;

    // Build a map of new actions with their allowDraft settings
    const newActionsMap = {};
    _.forEach(permissions, (type, typeName) => {
      _.forEach(type.controllers, (controller, controllerName) => {
        _.forEach(controller, (action, actionName) => {
          const { enabled, allowDraft = false /* policy */ } = action;
          if (enabled) {
            const actionKey = `${typeName}.${controllerName}.${actionName}`;
            newActionsMap[actionKey] = { action: actionKey, allowDraft };
          }
        });
      });
    });

    const newActions = Object.keys(newActionsMap);
    const oldActions = role.permissions.map(({ action }) => action);

    // Permissions to delete (enabled is now false)
    const toDelete = role.permissions.reduce((acc, permission) => {
      if (!newActions.includes(permission.action)) {
        acc.push(permission);
      }
      return acc;
    }, []);

    // Permissions to create (newly enabled)
    const toCreate = newActions
      .filter((action) => !oldActions.includes(action))
      .map((action) => ({ action, role: role.id, allowDraft: newActionsMap[action].allowDraft }));

    // Permissions to update (allowDraft changed)
    const toUpdate = role.permissions.reduce((acc, permission) => {
      if (newActions.includes(permission.action)) {
        const newAllowDraft = newActionsMap[permission.action].allowDraft;
        if (permission.allowDraft !== newAllowDraft) {
          acc.push({ id: permission.id, allowDraft: newAllowDraft });
        }
      }
      return acc;
    }, []);

    await Promise.all(
      toDelete.map((permission) =>
        strapi.db
          .query('plugin::users-permissions.permission')
          .delete({ where: { id: permission.id } })
      )
    );

    await Promise.all(
      toCreate.map((permissionInfo) =>
        strapi.db.query('plugin::users-permissions.permission').create({ data: permissionInfo })
      )
    );

    await Promise.all(
      toUpdate.map((permissionInfo) =>
        strapi.db
          .query('plugin::users-permissions.permission')
          .update({ where: { id: permissionInfo.id }, data: { allowDraft: permissionInfo.allowDraft } })
      )
    );
  },

  async deleteRole(roleID, publicRoleID) {
    const role = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { id: roleID }, populate: ['users', 'permissions'] });

    if (!role) {
      throw new NotFoundError('Role not found');
    }

    // Move users to guest role.
    await Promise.all(
      role.users.map((user) => {
        return strapi.db.query('plugin::users-permissions.user').update({
          where: { id: user.id },
          data: { role: publicRoleID },
        });
      })
    );

    // Remove permissions related to this role.
    // TODO: use delete many
    await Promise.all(
      role.permissions.map((permission) => {
        return strapi.db.query('plugin::users-permissions.permission').delete({
          where: { id: permission.id },
        });
      })
    );

    // Delete the role.
    await strapi.db.query('plugin::users-permissions.role').delete({ where: { id: roleID } });
  },
});
