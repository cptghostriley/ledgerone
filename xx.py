# Using passlib (as used in the project's dependency stack)
from passlib.hash import argon2
hashed = argon2.hash("Test@123")
print(hashed)
# Verification
is_correct = argon2.verify("Test@123", hashed) # Returns True