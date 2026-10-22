# GET /api/products/:id

- Auth: Optional (used to record recent view)
- 200: { success: true, data: Product }
- 404: { success: false, message: "Product not found" }
