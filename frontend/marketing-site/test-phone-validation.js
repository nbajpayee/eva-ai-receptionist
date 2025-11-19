/**
 * Test script to verify phone validation logic
 * Run with: node test-phone-validation.js
 */

// Simulate the validation logic
function validatePhone(phone) {
  // Step 1: Check format (only digits, spaces, parentheses, plus, dash)
  const formatRegex = /^[\d\s()+-]+$/;
  if (!formatRegex.test(phone)) {
    return { valid: false, error: "Phone number can only contain digits, spaces, parentheses, plus and dash" };
  }

  // Step 2: Check digit count (must have at least 10 digits)
  const digitCount = phone.replace(/\D/g, "").length;
  if (digitCount < 10) {
    return { valid: false, error: "Phone number must contain at least 10 digits" };
  }

  return { valid: true };
}

// Test cases
const testCases = [
  // Valid cases
  { input: "(555) 123-4567", expected: true, description: "Standard US format" },
  { input: "555-123-4567", expected: true, description: "Dashes only" },
  { input: "5551234567", expected: true, description: "No formatting" },
  { input: "+1 (555) 123-4567", expected: true, description: "International format" },
  { input: "555 123 4567", expected: true, description: "Spaces only" },

  // Invalid cases that SHOULD fail
  { input: "aaaaaaaaaa", expected: false, description: "All letters (should fail)" },
  { input: "(   )     ", expected: false, description: "Only spaces and parentheses (should fail)" },
  { input: "123", expected: false, description: "Too few digits (should fail)" },
  { input: "555-123", expected: false, description: "Incomplete number (should fail)" },
  { input: "555.123.4567", expected: false, description: "Dots not allowed (should fail)" },
  { input: "555 abc 4567", expected: false, description: "Contains letters (should fail)" },
];

console.log("🧪 Testing Phone Validation Logic\n");
console.log("=" .repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach(({ input, expected, description }) => {
  const result = validatePhone(input);
  const actualValid = result.valid;
  const testPassed = actualValid === expected;

  if (testPassed) {
    console.log(`✅ PASS: ${description}`);
    console.log(`   Input: "${input}"`);
    console.log(`   Result: ${actualValid ? "Valid" : `Invalid - ${result.error}`}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${description}`);
    console.log(`   Input: "${input}"`);
    console.log(`   Expected: ${expected ? "Valid" : "Invalid"}`);
    console.log(`   Actual: ${actualValid ? "Valid" : `Invalid - ${result.error}`}`);
    failed++;
  }
  console.log("");
});

console.log("=" .repeat(80));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
  console.log("✅ All tests passed! Phone validation is working correctly.");
} else {
  console.log("❌ Some tests failed. Phone validation needs fixes.");
  process.exit(1);
}
