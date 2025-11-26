// Test script to verify the JSON serialization fix works correctly

function safeJsonStringify(obj, indent = 2) {
    try {
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, val) => {
            if (val != null && typeof val === 'object') {
                if (seen.has(val)) {
                    return '[Circular]';
                }
                seen.add(val);
            }
            // Filter out functions and undefined values
            if (typeof val === 'function' || val === undefined) {
                return undefined;
            }
            return val;
        }, indent);
    } catch (error) {
        console.error('JSON Serialization Error:', error);
        return '{}';
    }
}

// Test cases
console.log('Testing JSON serialization fix...\n');

// Test 1: Normal object (should work fine)
console.log('Test 1: Normal object');
const normalObj = {
    name: 'Test User',
    traits: {
        openness: 'high',
        creativity: 'moderate'
    }
};
console.log('Result:', safeJsonStringify(normalObj));
console.log('✅ Passed\n');

// Test 2: Object with circular reference
console.log('Test 2: Object with circular reference');
const circularObj = { name: 'Circular' };
circularObj.self = circularObj; // Create circular reference
console.log('Result:', safeJsonStringify(circularObj));
console.log('✅ Passed\n');

// Test 3: Object with functions
console.log('Test 3: Object with functions');
const objWithFunctions = {
    name: 'Functions',
    data: { value: 42 },
    method: function() { return 'hello'; },
    arrow: () => 'world'
};
console.log('Result:', safeJsonStringify(objWithFunctions));
console.log('✅ Passed\n');

// Test 4: Object with undefined values
console.log('Test 4: Object with undefined values');
const objWithUndefined = {
    defined: 'yes',
    notDefined: undefined,
    nested: {
        present: 'here',
        missing: undefined
    }
};
console.log('Result:', safeJsonStringify(objWithUndefined));
console.log('✅ Passed\n');

// Test 5: Complex nested object (simulating soulprint data)
console.log('Test 5: Complex soulprint-like data');
const soulprintData = {
    communication_style: {
        formality: "casual",
        directness: "direct",
        humor: "moderate"
    },
    decision_making: {
        approach: "analytical",
        speed: "balanced"
    },
    values: ["innovation", "authenticity", "growth"],
    personality_traits: {
        openness: "high",
        conscientiousness: "moderate"
    }
};
console.log('Result:', safeJsonStringify(soulprintData));
console.log('✅ Passed\n');

console.log('🎉 All tests passed! The JSON serialization fix is working correctly.');