# GET /api/history/me

- Auth: JWT
- Query: type? ('product'|'brand'|'other'), limit?
- 200: { success: true, data: History[] }
