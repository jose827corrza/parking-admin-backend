import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

export interface Car {
    parking_id: string;
    plate_number: string;
    is_premium: boolean;
    ingress_datetime: string;
}

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || '';

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const claims = event.requestContext?.authorizer?.claims;

        validateAccess(claims);

        if (!event.body) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Bad Request: No body provided' }),
            };
        }

        const body = JSON.parse(event.body);

        const car: Car = {
            parking_id: body.parking_id,
            plate_number: body.plate_number,
            is_premium: body.is_premium,
            ingress_datetime: new Date().toISOString(),
        }

        await insertRecord(car);

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

const insertRecord = async (car: Car): Promise<void> => {
    const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: car,
    });

    await docClient.send(command);
}
