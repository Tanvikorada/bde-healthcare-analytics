from passlib.context import CryptContext
ctx = CryptContext(schemes=['bcrypt'], deprecated='auto')
hash_str = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"
result = ctx.verify('admin123', hash_str)
print("admin123 matches hash:", result)

# Generate a fresh one just in case
fresh = ctx.hash("admin123")
print("Fresh hash:", fresh)
print("Fresh verify:", ctx.verify("admin123", fresh))
