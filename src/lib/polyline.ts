export function encodePolyline(coordinates: {lat: number, lng: number}[]): string {
  let factor = 1e5;
  let result = '';
  let lastLat = 0;
  let lastLng = 0;

  for (let i = 0; i < coordinates.length; i++) {
    let lat = Math.round(coordinates[i].lat * factor);
    let lng = Math.round(coordinates[i].lng * factor);

    let dLat = lat - lastLat;
    let dLng = lng - lastLng;

    lastLat = lat;
    lastLng = lng;

    result += encode(dLat) + encode(dLng);
  }
  return result;
}

function encode(coordinate: number): string {
  coordinate = coordinate < 0 ? ~(coordinate << 1) : coordinate << 1;
  let result = '';
  while (coordinate >= 0x20) {
    result += String.fromCharCode((0x20 | (coordinate & 0x1f)) + 63);
    coordinate >>= 5;
  }
  result += String.fromCharCode(coordinate + 63);
  return result;
}
