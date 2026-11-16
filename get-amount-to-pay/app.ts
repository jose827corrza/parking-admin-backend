import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Car, PricingRecord } from '@shared/types';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    GetCommandOutput,
    UpdateCommand,
    UpdateCommandOutput,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const PARKING_TABLE_NAME = process.env.PARKING_TABLE_NAME || '';
const PARKING_PRICING_TABLE_NAME = process.env.PARKING_PRICING_TABLE_NAME || '';

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const claims = event.requestContext?.authorizer?.claims;

        const parkingId = event.pathParameters?.parking_id;
        const plateNumber = event.pathParameters?.plate_number;

        if (!parkingId || !plateNumber) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Missing required path parameters' }),
            };
        }

        validateAccess(claims);

        const parkingRecord = await retrieveParkingRecord(parkingId, plateNumber);
        const pricingRecord = await retrievePricingRecord(parkingId);

        if (!parkingRecord || !pricingRecord) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'One or more requested records not found' }),
            };
        }

        const ingressDate = new Date(parkingRecord.ingress_datetime);
        const egressDate = new Date();

        const amountToPay = calculateAmountToPay(ingressDate, egressDate);

        await updateValueToPayInRecord(parkingId, plateNumber, amountToPay);

        return {
            statusCode: 200,
            body: JSON.stringify({ data: { parkingRecord, amountToPay } }),
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
        : typeof rawGroups === 'string'
        ? rawGroups.split(',')
        : [];

    if (!groups.includes('admin') && !groups.includes('customer')) {
        return {
            statusCode: 403,
            body: JSON.stringify({ message: 'Forbidden: You do not have permission to perform this action' }),
        };
    }
};

const retrieveParkingRecord = async (parking_id: string, plate_number: string): Promise<Car | null> => {
    const command = new GetCommand({
        TableName: PARKING_TABLE_NAME,
        Key: {
            parking_id: parking_id,
            plate_number: plate_number,
        },
    });

    const response = await docClient.send(command);

    return response.Item as Car | null;
};

const retrievePricingRecord = async (parking_id: string): Promise<PricingRecord | null> => {
    const command = new GetCommand({
        TableName: PARKING_PRICING_TABLE_NAME,
        Key: {
            parking_id: parking_id,
        },
    });

    const response = await docClient.send(command);

    return response.Item as PricingRecord | null;
};

const calculateAmountToPay = (ingressDate: Date, egressDate: Date): number => {
    const diffInSeconds = Math.floor((egressDate.getTime() - ingressDate.getTime()) / 1000);

    if (diffInSeconds < 0) {
        throw new Error('Egress date cannot be earlier than ingress date.');
    }

    return diffInSeconds;
};

const updateValueToPayInRecord = async (
    parking_id: string,
    plate_number: string,
    to_pay: number,
): Promise<UpdateCommandOutput> => {
    const command = new UpdateCommand({
        TableName: PARKING_TABLE_NAME,
        Key: {
            parking_id: parking_id,
            plate_number: plate_number,
        },
        UpdateExpression: 'SET to_pay = :to_pay, updated_at = :updated_at',
        ExpressionAttributeValues: {
            ':to_pay': to_pay,
            ':updated_at': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
    });

    return await docClient.send(command);
};
