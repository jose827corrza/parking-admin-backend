import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, UpdateCommandOutput } from '@aws-sdk/lib-dynamodb';

export interface PricingRecord {
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

        isAdmin(claims);

        if (!event.body) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Bad Request: No body provided' }),
            };
        }

        const body = JSON.parse(event.body);

        const pricingRecord: PricingRecord = {
            parking_id: body.parking_id,
            parking_name: body.parking_name,
            price_by_minute: body.price_by_minute,
            updated_at: new Date().toISOString(),
        }

        const result = await upsertPricing(pricingRecord);
        console.log('Upserted Pricing Record:', result);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Success! Welcome, Admin.', data: result }),
        };

    } catch (err: any) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
        };
    }
};

const isAdmin = (claims: any) => {
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
}

const upsertPricing = async (payload: PricingRecord): Promise<PricingRecord> => {
    const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { parking_id: payload.parking_id },
        UpdateExpression: 'SET parking_name = :parking_name, price_by_minute = :price_by_minute, updated_at = :updated_at',
        ExpressionAttributeValues: {
            ':parking_name': payload.parking_name,
            ':price_by_minute': payload.price_by_minute,
            ':updated_at': payload.updated_at,
        },
        ReturnValues: 'ALL_NEW',
    });

    const response = await docClient.send(command) as UpdateCommandOutput;
    
    return response.Attributes as PricingRecord;
}
