# PATCH /api/apikeys/activate/:key

- Method: PATCH
- Auth: None
- Params: key (string)

Responses:
- 200 OK
  { "message": "Key activated", "active": true, "key": "<key>" }
- 400 Bad Request
  { "message": "label is required" }
