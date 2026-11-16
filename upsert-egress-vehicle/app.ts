import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, UpdateCommandOutput } from '@aws-sdk/lib-dynamodb';
import { Attendance, Car } from '@shared/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const PARKING_TABLE_NAME = process.env.PARKING_TABLE_NAME;

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

        const record = await retrieveParkingRecord(body.parking_id, body.plate_number);

        if(!record) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Record not found.' }),
            };
        }

        const attendance: Attendance = {
            ingress_datetime: record.ingress_datetime,
            egress_datetime: new Date().toISOString(),
        };

        const result = await upsertWithAttendance(body.parking_id, body.plate_number,attendance);
        console.log('Upserted Pricing Record:', result);
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

const retrieveParkingRecord = async (parking_id: string, plate_number: string): Promise<Car | null> => {
    const command = new GetCommand({
        TableName: PARKING_TABLE_NAME,
        Key: { 
            parking_id: parking_id,
            plate_number: plate_number
        },
    });

    const response = await docClient.send(command);
    
    return response.Item as Car | null;
}

const upsertWithAttendance = async (parking_id: string, plate_number: string, newAttendance: Attendance): Promise<Car> => {
    const command = new UpdateCommand({
        TableName: PARKING_TABLE_NAME,
        Key: { 
            parking_id: parking_id,
            plate_number: plate_number
        },
        UpdateExpression: 'SET ingress_datetime = :blank_ingress, to_pay = :to_pay, registry = list_append(if_not_exists(registry, :empty_list), :new_attendance_list), updated_at = :updated_at',
        ExpressionAttributeValues: {
            ':blank_ingress': '',
            ':to_pay': 0,
            ':empty_list': [],
            ':new_attendance_list': [newAttendance],
            ':updated_at': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
    });

    const response = await docClient.send(command) as UpdateCommandOutput;
    
    return response.Attributes as Car;
}
