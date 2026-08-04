import { SegmentIdentifier } from '../types/rideSession.types';

export function getSegmentKey(segment: SegmentIdentifier): string {
  const rideId = segment.rideId || 'none';
  const depOrder = segment.departureWaypointOrder !== undefined ? segment.departureWaypointOrder : 'all';
  const arrOrder = segment.arrivalWaypointOrder !== undefined ? segment.arrivalWaypointOrder : 'all';
  const date = segment.date || 'today';
  return `ride_${rideId}:${depOrder}:${arrOrder}:${date}`;
}

export function isSameSegment(a: SegmentIdentifier, b: SegmentIdentifier): boolean {
  return getSegmentKey(a) === getSegmentKey(b);
}
