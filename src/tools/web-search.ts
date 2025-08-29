import type { ToolFunction } from './tool-registry';

export const webSearchTool: ToolFunction = {
    name: 'web_search',
    description: 'Search the web for current information on any topic. Returns relevant search results with titles, URLs, and snippets.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query to look up on the web'
            },
            num_results: {
                type: 'number',
                description: 'Number of search results to return (default: 5, max: 10)',
                minimum: 1,
                maximum: 10
            }
        },
        required: ['query']
    },
    async execute(args: { query: string; num_results?: number }): Promise<any> {
        const { query, num_results = 5 } = args;
        
        try {
            const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
            
            const response = await fetch(searchUrl);
            if (!response.ok) {
                throw new Error(`Search API returned ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            const results = (data.RelatedTopics || [])
                .slice(0, Math.min(num_results, 10))
                .map((topic: any, index: number) => ({
                    title: topic.Text?.split(' - ')[0] || `Result ${index + 1}`,
                    url: topic.FirstURL || '',
                    snippet: topic.Text || 'No description available'
                }));

            if (results.length === 0) {
                return {
                    query,
                    results: [],
                    message: 'No search results found. This might be due to API limitations or the query being too specific.'
                };
            }

            return {
                query,
                results,
                total_results: results.length
            };
        } catch (error) {
            return {
                query,
                results: [],
                error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
                message: 'Web search is currently unavailable. This is a simulated response.'
            };
        }
    }
};
