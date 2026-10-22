# GET /api/follow/me

Requires JWT. Returns the current user's followed brands list populated.

Response: { success: true, data: { userId, brands: [Brand] } }
