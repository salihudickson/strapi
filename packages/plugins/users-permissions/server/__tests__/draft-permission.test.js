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
