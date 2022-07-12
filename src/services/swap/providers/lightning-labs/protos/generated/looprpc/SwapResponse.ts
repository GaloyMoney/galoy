// Original file: ../loop.proto


export interface SwapResponse {
  'id'?: (string);
  'htlcAddress'?: (string);
  'idBytes'?: (Buffer | Uint8Array | string);
  'htlcAddressNp2wsh'?: (string);
  'htlcAddressP2wsh'?: (string);
  'serverMessage'?: (string);
}

export interface SwapResponse__Output {
  'id': (string);
  'htlcAddress': (string);
  'idBytes': (Buffer);
  'htlcAddressNp2wsh': (string);
  'htlcAddressP2wsh': (string);
  'serverMessage': (string);
}
