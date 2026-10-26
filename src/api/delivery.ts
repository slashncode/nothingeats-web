import { queryOptions } from '@tanstack/react-query';

import { request } from './http';

// /api/delivery/v1 (nothingeats-delivery-service): the plan, routes and courier of an order.

export interface Point {
    latitude: number;
    longitude: number;
}

export interface Delivery {
    orderId: string;
    status: 'ACCEPTED' | 'COOKING' | 'PICKED_UP' | 'EN_ROUTE' | 'DELIVERED';
    restaurantName: string;
    pickup: Point;
    dropOff: Point;
    dropOffLabel: string | null;
    courier: { name: string; vehicle: 'BIKE' | 'CARGO_BIKE' | 'SCOOTER'; position: Point };
    approachRoute: Point[];
    deliveryRoute: Point[];
    steps: { status: Delivery['status']; at: string; done: boolean }[];
    estimatedArrivalAt: string;
    serverTime: string;
}

export const deliveryKeys = {
    delivery: (orderId: string) => ['delivery', orderId] as const,
};

export const deliveryQueries = {
    // Right after checkout the delivery service may not have taken the order yet (404 for a moment).
    delivery: (orderId: string) => queryOptions({
        queryKey: deliveryKeys.delivery(orderId),
        queryFn: ({ signal }) => request<Delivery>(`/api/delivery/v1/deliveries/${encodeURIComponent(orderId)}`, { auth: true, signal }),
        retry: 10,
        retryDelay: 1000,
    }),
};
