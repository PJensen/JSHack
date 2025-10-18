// Simple test to verify imports work
try {
  console.log('Testing imports...');
  
  // Test core import
  import('../../src/ecs/core.js').then(core => {
    console.log('✓ Core module loaded:', Object.keys(core));
  }).catch(err => {
    console.error('✗ Core module failed:', err);
  });
  
  // Test serialization import  
  import('../../src/ecs/serialization.js').then(ser => {
    console.log('✓ Serialization module loaded:', Object.keys(ser));
  }).catch(err => {
    console.error('✗ Serialization module failed:', err);
  });
  
} catch (err) {
  console.error('Import test failed:', err);
}