import { prisma } from '@/lib/prisma'
import type {
  HierarchyLevelLabels,
  HierarchyLevelDefinition,
} from '@/lib/services/branch-hierarchy'

export interface Church {
  id: string
  name: string
  slug?: string
  description?: string
  tagline?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  phone?: string
  email?: string
  organizationEmail?: string
  website?: string
  givingLink?: string
  defaultLocale?: string
  timezone?: string
  logo?: string
  secondaryLogo?: string
  ownerId?: string
  subscriptionId?: string
  preferredPlanId?: string
  estimatedMembers?: number
  hierarchyLevelLabels?: HierarchyLevelLabels
  hierarchyLevels?: HierarchyLevelDefinition[]
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  brandFont?: string
  buttonShape?: 'rounded' | 'pill' | 'square'
  customDomain?: string
  domainVerified?: boolean
  loginHeroImage?: string
  emailHeaderImage?: string
  socialPreviewText?: string
  createdAt: Date
  updatedAt: Date
}

export class ChurchService {
  /**
   * Merge a Prisma church record with any legacy firestoreData
   */
  private static fromPrisma(record: any): Church {
    const { firestoreData, ...rest } = record
    const legacy = (firestoreData as Record<string, unknown>) || {}
    return { ...legacy, ...rest } as unknown as Church
  }

  /**
   * Find church by ID
   */
  static async findById(id: string): Promise<Church | null> {
    const record = await prisma.church.findUnique({ where: { id } })
    if (!record) return null
    return this.fromPrisma(record)
  }

  /**
   * Create church
   */
  static async create(data: Omit<Church, 'id' | 'createdAt' | 'updatedAt'>): Promise<Church> {
    const record = await prisma.church.create({
      data: {
        name: data.name,
        slug: data.slug || generateSlug(data.name),
        logo: data.logo,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country,
        phone: data.phone,
        email: data.email ?? data.organizationEmail,
        website: data.website,
        description: data.description,
        customDomain: data.customDomain,
        domainVerified: data.domainVerified,
        ownerId: data.ownerId,
      },
    })
    return this.fromPrisma(record)
  }

  /**
   * Update church
   */
  static async update(id: string, data: Partial<Omit<Church, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Church> {
    const record = await prisma.church.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        logo: data.logo,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country,
        phone: data.phone,
        email: data.email ?? data.organizationEmail,
        website: data.website,
        description: data.description,
        customDomain: data.customDomain,
        domainVerified: data.domainVerified,
        ownerId: data.ownerId,
      },
    })
    return this.fromPrisma(record)
  }

  /**
   * Find all churches (for superadmin)
   */
  static async findAll(): Promise<Church[]> {
    const records = await prisma.church.findMany({ orderBy: { createdAt: 'desc' } })
    return records.map((record) => this.fromPrisma(record))
  }

  /**
   * Find church by slug
   */
  static async findBySlug(slug: string): Promise<Church | null> {
    const record = await prisma.church.findUnique({ where: { slug } })
    if (!record) return null
    return this.fromPrisma(record)
  }

  /**
   * Find church by custom domain
   */
  static async findByCustomDomain(domain: string): Promise<Church | null> {
    const record = await prisma.church.findFirst({ where: { customDomain: domain } })
    if (!record) return null
    return this.fromPrisma(record)
  }
}

/**
 * Generate a URL-friendly slug from church name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

