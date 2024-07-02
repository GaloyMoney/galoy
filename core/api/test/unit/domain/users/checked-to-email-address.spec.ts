import { InvalidEmailAddress } from "@/domain/errors"
import { checkedToEmailAddress } from "@/domain/users"

describe("checkedToEmailAddress", () => {
  describe("Valid email addresses", () => {
    const validEmails = [
      "test@example.com",
      "user.name+tag+sorting@example.com",
      "x@example.com",
      "example-indeed@strange-example.com",
      "admin@mailserver1.com",
      "w1s@m3mp00l.spice",
    ]

    it.each(validEmails)(
      'should return the email address "%s" if it is valid',
      (email) => {
        const result = checkedToEmailAddress(email)
        expect(result).toBe(email)
      },
    )
  })

  describe("Invalid email addresses", () => {
    const invalidEmails = [
      "plainaddress",
      "@missingusername.com",
      "username@.com",
      "username@com",
      "username@-example.com",
      "username@.com.",
      "username@-example.com.",
    ]

    it.each(invalidEmails)(
      'should return an InvalidEmailAddress error for "%s"',
      (email) => {
        const result = checkedToEmailAddress(email)
        expect(result).toBeInstanceOf(InvalidEmailAddress)

        const error = result as InvalidEmailAddress
        expect(error.message).toBe(email)
      },
    )
  })
})
