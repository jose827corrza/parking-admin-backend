import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const claims = event.requestContext?.authorizer?.claims;

        if (!claims) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: 'Unauthorized: No authorization claims found' }),
            };
        }

        const rawGroups = claims['cognito:groups'];
        const groups: string[] = Array.isArray(rawGroups) 
            ? rawGroups 
            : (typeof rawGroups === 'string' ? rawGroups.split(',') : []);

        if (!groups.includes('admin')) {
            return {
                statusCode: 403,
                body: JSON.stringify({ message: 'Forbidden: Admin role required' }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Success! Welcome, Admin.' }),
        };

    } catch (err: any) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
        };
    }
};
