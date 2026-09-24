// External links used across the marketing site.
//
// Any value left as null renders as a placeholder <a> with no href (valid
// HTML, not clickable) so the layout and copy stay intact until the real
// URL is supplied. Do not guess these — fill them in from the real profiles.

// Akshay Kumar's LinkedIn (About page, founder section).
export const FOUNDER_LINKEDIN_URL = 'https://www.linkedin.com/in/akshaykumar91/'

// Founder portrait — 4:5 crop (640×800) of the photo Akshay supplied.
// Set to null to fall back to an empty frame; never a stock/generated image.
export const FOUNDER_PHOTO_URL = '/brand/akshay-kumar.jpg'

// TODO: insert the AMFI page that verifies ARN 367667 (About page, Fold 7).
export const AMFI_REGISTRATION_URL = null

// TODO: no Disclosures page exists yet — insert its route/URL once it does.
export const DISCLOSURES_URL = null

// Company social profiles, shown in the global footer.
export const SOCIAL_LINKS = [
  { label: 'Instagram', icon: 'instagram', url: null }, // TODO: company Instagram URL
  { label: 'LinkedIn',  icon: 'linkedin',  url: null }, // TODO: company LinkedIn URL
  { label: 'Facebook',  icon: 'facebook',  url: null }, // TODO: company Facebook URL
]

export const CONTACT_EMAIL = 'taru@taru.money'
