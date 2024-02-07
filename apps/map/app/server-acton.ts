"use server"

import { merchantMapSuggest } from "@/services/galoy/graphql/mutation/merchant-map-suggest"

export const submitMerchantSuggest = async (
  _prevState: {
    error: boolean
    message: string
  },
  form: FormData,
): Promise<{
  error: boolean
  message: string
}> => {
  const title = form.get("title")
  const username = form.get("username")
  const latitude = form.get("latitude")
  const longitude = form.get("longitude")
  if (
    !title ||
    !username ||
    !latitude ||
    !longitude ||
    typeof title !== "string" ||
    typeof username != "string" ||
    typeof latitude != "string" ||
    typeof longitude != "string"
  ) {
    return {
      error: true,
      message: "Missing fields",
    }
  }

  const lat = parseFloat(latitude)
  const lon = parseFloat(longitude)

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return {
      error: true,
      message: "Invalid coordinates",
    }
  }

  const response = await merchantMapSuggest({
    title,
    username,
    latitude: lat,
    longitude: lon,
  })

  if (response instanceof Error) {
    return {
      error: true,
      message: response.message,
    }
  }

  if (response.errors.length > 0) {
    return {
      error: true,
      message: response.errors[0].message,
    }
  }

  return {
    error: false,
    message: "success",
  }
}
