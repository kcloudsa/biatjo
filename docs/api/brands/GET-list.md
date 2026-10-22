# GET /api/brands

- Query: q, active
- Auth: None
- Response 200: { success: true, data: Brand[] }

Notes:
- If authenticated, each Brand item includes `isFollowed: boolean` for the current user.
