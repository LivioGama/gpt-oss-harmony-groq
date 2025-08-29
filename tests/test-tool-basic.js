#!/usr/bin/env node

import { defaultToolExecutor, defaultToolRegistry } from '../src/tools/index.js';

console.log('🧪 Testing Tool System Basic Functionality');
console.log('==========================================');

async function testCalculator() {
    console.log('\n🧮 Testing Calculator Tool...');
    
    try {
        const result = await defaultToolExecutor.executeToolCall({
            id: 'test-calc-1',
            type: 'function',
            function: {
                name: 'calculator',
                arguments: JSON.stringify({ expression: '2 + 3 * 4' })
            }
        });
        
        console.log('✅ Calculator result:', result);
        return result.success;
    } catch (error) {
        console.error('❌ Calculator test failed:', error.message);
        return false;
    }
}

async function testFileOperations() {
    console.log('\n📁 Testing File Operations Tool...');
    
    try {
        const result = await defaultToolExecutor.executeToolCall({
            id: 'test-file-1',
            type: 'function',
            function: {
                name: 'file_operations',
                arguments: JSON.stringify({ 
                    operation: 'list',
                    path: '.'
                })
            }
        });
        
        console.log('✅ File operations result:', result.success ? 'SUCCESS' : 'FAILED');
        if (result.result) {
            console.log('   Files found:', result.result.count);
        }
        return result.success;
    } catch (error) {
        console.error('❌ File operations test failed:', error.message);
        return false;
    }
}

async function testCodeExecution() {
    console.log('\n💻 Testing Code Execution Tool...');
    
    try {
        const result = await defaultToolExecutor.executeToolCall({
            id: 'test-code-1',
            type: 'function',
            function: {
                name: 'execute_code',
                arguments: JSON.stringify({ 
                    language: 'javascript',
                    code: 'console.log("Hello from tool execution!"); Math.sqrt(16);'
                })
            }
        });
        
        console.log('✅ Code execution result:', result.success ? 'SUCCESS' : 'FAILED');
        if (result.result) {
            console.log('   Output:', result.result.stdout);
        }
        return result.success;
    } catch (error) {
        console.error('❌ Code execution test failed:', error.message);
        return false;
    }
}

async function testToolRegistry() {
    console.log('\n🔧 Testing Tool Registry...');
    
    const tools = defaultToolRegistry.getAllTools();
    console.log(`✅ Found ${tools.length} registered tools:`);
    
    for (const tool of tools) {
        console.log(`   • ${tool.name}: ${tool.description.substring(0, 50)}...`);
    }
    
    return tools.length > 0;
}

async function runTests() {
    console.log('Starting tool system tests...\n');
    
    const tests = [
        { name: 'Tool Registry', fn: testToolRegistry },
        { name: 'Calculator', fn: testCalculator },
        { name: 'File Operations', fn: testFileOperations },
        { name: 'Code Execution', fn: testCodeExecution }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            const result = await test.fn();
            if (result) {
                passed++;
                console.log(`✅ ${test.name} test PASSED`);
            } else {
                failed++;
                console.log(`❌ ${test.name} test FAILED`);
            }
        } catch (error) {
            failed++;
            console.log(`❌ ${test.name} test ERROR:`, error.message);
        }
    }
    
    console.log('\n📊 Test Results:');
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total:  ${passed + failed}`);
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed! Tool system is working correctly.');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed. Check the output above for details.');
        process.exit(1);
    }
}

runTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
});
