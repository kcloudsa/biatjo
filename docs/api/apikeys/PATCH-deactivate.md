# PATCH /api/apikeys/deactivate/:key

- Method: PATCH
- Auth: None
- Params: key (string)

Responses:
- 200 OK
  { "message": "Key deactivated", "active": false, "key": "<key>" }
- 400 Bad Request
  { "message": "label is required" }
