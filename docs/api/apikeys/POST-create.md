# POST /api/apikeys/create

- Method: POST
- Auth: None
- Body:
  - label: string (required)
  - userID: string (required)

Responses:
- 201 Created
  { "key": "<generated>", "label": "..." }
- 400 Bad Request
  { "message": "label or userID are required" }
