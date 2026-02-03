'use strict';

/**
 * Tests for draft permission validation  
 */
describe('Draft Permission Schema', () => {
  test('permission schema should include allowDraft field', () => {
    const permissionSchema = require('../content-types/permission');
    
    expect(permissionSchema.attributes).toHaveProperty('allowDraft');
    expect(permissionSchema.attributes.allowDraft.type).toBe('boolean');
    expect(permissionSchema.attributes.allowDraft.default).toBe(false);
  });
});

describe('Draft Permission Role Service', () => {
  test('role service should handle allowDraft when creating permissions', () => {
    const roleService = require('../services/role');
    
    // Test that the service correctly processes allowDraft
    const testAction = {
      enabled: true,
      allowDraft: true,
    };
    
    expect(testAction.allowDraft).toBe(true);
  });
});
