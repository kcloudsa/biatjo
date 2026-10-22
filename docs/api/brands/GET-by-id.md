# GET /api/brands/:id

- Params: id
- Auth: Optional (used to record recent view if provided)
- Response 200: { success: true, data: Brand }
- If authenticated, response includes `isFollowed: boolean` for the current user.
- 404: { success: false, message: "Brand not found" }
