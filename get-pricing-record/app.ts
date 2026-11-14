import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, GetCommandOutput, UpdateCommand, UpdateCommandOutput } from '@aws-sdk/lib-dynamodb';

interface PricingRecord {
    parking_id: string;
    parking_name: string;
    price_by_minute: boolean;
    updated_at: string;
}

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || '';

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const claims = event.requestContext?.authorizer?.claims;

        const parkingId = event.pathParameters?.parking_id;

        if (!parkingId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Missing parking_id path parameter' }),
            };
        }

        validateAccess(claims);

        const result = await getPricingRecord(parkingId);

        return {
            statusCode: 200,
            body: JSON.stringify({ data: result }),
        };

    } catch (err: any) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
        };
    }
};

const validateAccess = (claims: any) => {
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

        if (!groups.includes('admin') && !groups.includes('customer')) {
            return {
                statusCode: 403,
                body: JSON.stringify({ message: 'Forbidden: You do not have permission to perform this action' }),
            };
        }
}

const getPricingRecord = async (parking_id: string): Promise<PricingRecord> => {
    const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                parking_id,
            },
        });

    const response = await docClient.send(command) as GetCommandOutput;

    if (!response.Item) {
            throw new Error(`Pricing record not found for parking_id: ${parking_id}`);
        }
    
    return response.Item as PricingRecord;
}