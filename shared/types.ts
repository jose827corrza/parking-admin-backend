
export interface PricingRecord {
    parking_id: string;
    parking_name: string;
    price_by_minute: boolean;
    updated_at: string;
}

export interface Car {
    parking_id: string;
    plate_number: string;
    is_premium: boolean;
    ingress_datetime: string;
    to_pay?: number;
    attendance?: Attendance[];
}

export interface Attendance {
    ingress_datetime: string;
    egress_datetime: string;
}

export interface PricingRecord {
    parking_id: string;
    parking_name: string;
    price_by_minute: boolean;
    updated_at: string;
}

export interface Earning {
    parking_id: string;
    date: string;
    ingress: number[];
    total_ingress: number;
    updated_at: string;
}