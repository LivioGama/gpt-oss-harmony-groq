import type { ToolFunction } from './tool-registry';

export const calculatorTool: ToolFunction = {
    name: 'calculator',
    description: 'Perform mathematical calculations including basic arithmetic, trigonometry, and advanced functions.',
    parameters: {
        type: 'object',
        properties: {
            expression: {
                type: 'string',
                description: 'Mathematical expression to evaluate (e.g., "2 + 3 * 4", "sin(pi/2)", "sqrt(16)")'
            },
            precision: {
                type: 'number',
                description: 'Number of decimal places for the result (default: 10, max: 15)',
                minimum: 0,
                maximum: 15
            }
        },
        required: ['expression']
    },
    async execute(args: { expression: string; precision?: number }): Promise<any> {
        const { expression, precision = 10 } = args;
        
        try {
            const safePrecision = Math.min(Math.max(0, precision), 15);
            
            let sanitizedExpression = expression
                .replace(/[^0-9+\-*/().\s,a-zA-Z]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            
            const mathFunctions = {
                'sin': Math.sin,
                'cos': Math.cos,
                'tan': Math.tan,
                'asin': Math.asin,
                'acos': Math.acos,
                'atan': Math.atan,
                'sinh': Math.sinh,
                'cosh': Math.cosh,
                'tanh': Math.tanh,
                'log': Math.log,
                'log10': Math.log10,
                'log2': Math.log2,
                'exp': Math.exp,
                'sqrt': Math.sqrt,
                'cbrt': Math.cbrt,
                'abs': Math.abs,
                'ceil': Math.ceil,
                'floor': Math.floor,
                'round': Math.round,
                'max': Math.max,
                'min': Math.min,
                'pow': Math.pow
            };
            
            const mathConstants = {
                'pi': Math.PI,
                'e': Math.E,
                'PI': Math.PI,
                'E': Math.E
            };
            
            for (const [name, value] of Object.entries(mathConstants)) {
                const regex = new RegExp(`\\b${name}\\b`, 'g');
                sanitizedExpression = sanitizedExpression.replace(regex, value.toString());
            }
            
            for (const [name, func] of Object.entries(mathFunctions)) {
                const regex = new RegExp(`\\b${name}\\s*\\(`, 'g');
                sanitizedExpression = sanitizedExpression.replace(regex, `Math.${name}(`);
            }
            
            if (!/^[0-9+\-*/().\s,Math.]+$/.test(sanitizedExpression)) {
                throw new Error('Invalid characters in expression');
            }
            
            const result = Function(`"use strict"; return (${sanitizedExpression})`)();
            
            if (typeof result !== 'number') {
                throw new Error('Expression did not evaluate to a number');
            }
            
            if (!isFinite(result)) {
                return {
                    expression,
                    result: result.toString(),
                    formatted_result: result.toString(),
                    is_finite: false,
                    precision: safePrecision
                };
            }
            
            const roundedResult = Number(result.toFixed(safePrecision));
            const formattedResult = roundedResult.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: safePrecision
            });
            
            return {
                expression,
                result: roundedResult,
                formatted_result: formattedResult,
                is_finite: true,
                precision: safePrecision,
                original_expression: expression
            };
            
        } catch (error) {
            return {
                expression,
                error: `Calculation failed: ${error instanceof Error ? error.message : String(error)}`,
                message: 'Please check your mathematical expression for syntax errors.'
            };
        }
    }
};
