# GET /api/purchased-items

- Auth: JWT
- Query: mine=true | userId=... (admin), productId?
- 200: { success: true, data }
- 403 if forbidden
