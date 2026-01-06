import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * 組織階層のClosure Tableを構築する関数
 * 
 * @param tenantId テナントID
 * @param organizationId 組織ID
 * @param parentId 親組織ID（nullの場合はルート）
 */
async function buildOrganizationClosure(
  tenantId: string,
  organizationId: string,
  parentId: string | null = null
) {
  // 自己参照を追加（depth = 0）
  await prisma.organizationClosure.upsert({
    where: {
      ancestorId_descendantId: {
        ancestorId: organizationId,
        descendantId: organizationId,
      },
    },
    update: {},
    create: {
      tenantId,
      ancestorId: organizationId,
      descendantId: organizationId,
      depth: 0,
    },
  });

  // 親組織がある場合、親のすべての祖先との関係を追加
  if (parentId) {
    // 親のすべての祖先を取得
    const parentAncestors = await prisma.organizationClosure.findMany({
      where: {
        tenantId,
        descendantId: parentId,
      },
    });

    // 親のすべての祖先に対して、現在の組織との関係を追加
    for (const ancestor of parentAncestors) {
      await prisma.organizationClosure.upsert({
        where: {
          ancestorId_descendantId: {
            ancestorId: ancestor.ancestorId,
            descendantId: organizationId,
          },
        },
        update: {},
        create: {
          tenantId,
          ancestorId: ancestor.ancestorId,
          descendantId: organizationId,
          depth: ancestor.depth + 1,
        },
      });
    }
  }
}

async function main() {
  console.log("🌱 Starting seed...");

  // ============================================
  // 1. テナントの作成
  // ============================================
  console.log("📦 Creating tenants...");

  const zenmaoTenant = await prisma.tenant.upsert({
    where: { slug: "zenmao" },
    update: {},
    create: {
      name: "ZenMao Inc.",
      slug: "zenmao",
      isActive: true,
    },
  });

  const partnerTenant = await prisma.tenant.upsert({
    where: { slug: "demo-partner" },
    update: {},
    create: {
      name: "Demo Partner Corp.",
      slug: "demo-partner",
      isActive: true,
    },
  });

  console.log("✅ Tenants created");

  // ============================================
  // 2. 権限 (Permission) の作成
  // ============================================
  console.log("🔐 Creating permissions...");

  const resources = ["Lead", "Customer", "User", "Deal", "Organization", "Product", "KpiRecord", "PlRecord", "Simulation", "ScrapingJob"];
  const actions = ["read", "create", "update", "delete"];

  const permissions: Record<string, { id: string; resource: string; action: string }> = {};

  // ZenMaoテナントの権限を作成
  for (const resource of resources) {
    for (const action of actions) {
      const key = `${resource}:${action}`;
      const permission = await prisma.permission.upsert({
        where: {
          tenantId_resource_action: {
            tenantId: zenmaoTenant.id,
            resource,
            action,
          },
        },
        update: {},
        create: {
          tenantId: zenmaoTenant.id,
          resource,
          action,
          description: `${resource} ${action} permission`,
          isSystemPermission: true,
        },
      });
      permissions[`zenmao:${key}`] = permission;
    }
  }

  // Partnerテナントの権限を作成
  for (const resource of resources) {
    for (const action of actions) {
      const key = `${resource}:${action}`;
      const permission = await prisma.permission.upsert({
        where: {
          tenantId_resource_action: {
            tenantId: partnerTenant.id,
            resource,
            action,
          },
        },
        update: {},
        create: {
          tenantId: partnerTenant.id,
          resource,
          action,
          description: `${resource} ${action} permission`,
          isSystemPermission: true,
        },
      });
      permissions[`partner:${key}`] = permission;
    }
  }

  console.log("✅ Permissions created");

  // ============================================
  // 3. ロール (Role) の作成
  // ============================================
  console.log("👥 Creating roles...");

  // Super Admin: 全ての権限
  const zenmaoSuperAdminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: zenmaoTenant.id,
        name: "Super Admin",
      },
    },
    update: {},
    create: {
      tenantId: zenmaoTenant.id,
      name: "Super Admin",
      description: "全ての権限を持つ管理者ロール",
      isSystemRole: true,
      isActive: true,
    },
  });

  // Org Admin: 組織管理に必要な権限
  const zenmaoOrgAdminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: zenmaoTenant.id,
        name: "Org Admin",
      },
    },
    update: {},
    create: {
      tenantId: zenmaoTenant.id,
      name: "Org Admin",
      description: "組織管理に必要な権限を持つロール",
      isSystemRole: true,
      isActive: true,
    },
  });

  // User: 基本的な閲覧・作成権限のみ
  const zenmaoUserRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: zenmaoTenant.id,
        name: "User",
      },
    },
    update: {},
    create: {
      tenantId: zenmaoTenant.id,
      name: "User",
      description: "基本的な閲覧・作成権限のみを持つロール",
      isSystemRole: true,
      isActive: true,
    },
  });

  // Partner側のロールも作成
  const partnerSuperAdminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: partnerTenant.id,
        name: "Super Admin",
      },
    },
    update: {},
    create: {
      tenantId: partnerTenant.id,
      name: "Super Admin",
      description: "全ての権限を持つ管理者ロール",
      isSystemRole: true,
      isActive: true,
    },
  });

  const partnerUserRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: partnerTenant.id,
        name: "User",
      },
    },
    update: {},
    create: {
      tenantId: partnerTenant.id,
      name: "User",
      description: "基本的な閲覧・作成権限のみを持つロール",
      isSystemRole: true,
      isActive: true,
    },
  });

  console.log("✅ Roles created");

  // ============================================
  // 4. ロールに権限を割り当て
  // ============================================
  console.log("🔗 Assigning permissions to roles...");

  // Super Admin: 全ての権限を割り当て
  for (const resource of resources) {
    for (const action of actions) {
      const key = `zenmao:${resource}:${action}`;
      if (permissions[key]) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: zenmaoSuperAdminRole.id,
              permissionId: permissions[key].id,
            },
          },
          update: {},
          create: {
            roleId: zenmaoSuperAdminRole.id,
            permissionId: permissions[key].id,
            tenantId: zenmaoTenant.id,
          },
        });
      }
    }
  }

  // Org Admin: 組織管理に必要な権限を割り当て
  const orgAdminPermissions = [
    "Organization:read",
    "Organization:create",
    "Organization:update",
    "User:read",
    "User:create",
    "User:update",
    "Customer:read",
    "Customer:create",
    "Customer:update",
    "Deal:read",
    "Deal:create",
    "Deal:update",
  ];
  for (const permKey of orgAdminPermissions) {
    const key = `zenmao:${permKey}`;
    if (permissions[key]) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: zenmaoOrgAdminRole.id,
            permissionId: permissions[key].id,
          },
        },
        update: {},
        create: {
          roleId: zenmaoOrgAdminRole.id,
          permissionId: permissions[key].id,
          tenantId: zenmaoTenant.id,
        },
      });
    }
  }

  // User: 基本的な閲覧・作成権限のみ
  const userPermissions = [
    "Lead:read",
    "Lead:create",
    "Customer:read",
    "Customer:create",
    "Deal:read",
    "Deal:create",
  ];
  for (const permKey of userPermissions) {
    const key = `zenmao:${permKey}`;
    if (permissions[key]) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: zenmaoUserRole.id,
            permissionId: permissions[key].id,
          },
        },
        update: {},
        create: {
          roleId: zenmaoUserRole.id,
          permissionId: permissions[key].id,
          tenantId: zenmaoTenant.id,
        },
      });
    }
  }

  // Partner Super Admin: 全ての権限を割り当て
  for (const resource of resources) {
    for (const action of actions) {
      const key = `partner:${resource}:${action}`;
      if (permissions[key]) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: partnerSuperAdminRole.id,
              permissionId: permissions[key].id,
            },
          },
          update: {},
          create: {
            roleId: partnerSuperAdminRole.id,
            permissionId: permissions[key].id,
            tenantId: partnerTenant.id,
          },
        });
      }
    }
  }

  console.log("✅ Permissions assigned to roles");

  // ============================================
  // 5. 組織 (Organization) の作成
  // ============================================
  console.log("🏢 Creating organizations...");

  // ZenMao配下の組織階層
  const zenmaoHeadquarters = await prisma.organization.upsert({
    where: {
      tenantId_code: {
        tenantId: zenmaoTenant.id,
        code: "ZENMAO-HQ",
      },
    },
    update: {},
    create: {
      tenantId: zenmaoTenant.id,
      name: "本社",
      code: "ZENMAO-HQ",
      type: "DIRECT",
      parentId: null,
      path: "/zenmao-hq",
      level: 0,
      isActive: true,
    },
  });

  const zenmaoSalesDept = await prisma.organization.upsert({
    where: {
      tenantId_code: {
        tenantId: zenmaoTenant.id,
        code: "ZENMAO-SALES",
      },
    },
    update: {},
    create: {
      tenantId: zenmaoTenant.id,
      name: "営業部",
      code: "ZENMAO-SALES",
      type: "DIRECT",
      parentId: zenmaoHeadquarters.id,
      path: "/zenmao-hq/sales",
      level: 1,
      isActive: true,
    },
  });

  const zenmaoMarketingDept = await prisma.organization.upsert({
    where: {
      tenantId_code: {
        tenantId: zenmaoTenant.id,
        code: "ZENMAO-MARKETING",
      },
    },
    update: {},
    create: {
      tenantId: zenmaoTenant.id,
      name: "マーケティング部",
      code: "ZENMAO-MARKETING",
      type: "DIRECT",
      parentId: zenmaoHeadquarters.id,
      path: "/zenmao-hq/marketing",
      level: 1,
      isActive: true,
    },
  });

  // Partner配下の組織
  const partnerBranchA = await prisma.organization.upsert({
    where: {
      tenantId_code: {
        tenantId: partnerTenant.id,
        code: "PARTNER-BRANCH-A",
      },
    },
    update: {},
    create: {
      tenantId: partnerTenant.id,
      name: "支店A",
      code: "PARTNER-BRANCH-A",
      type: "PARTNER_1ST",
      parentId: null,
      path: "/partner-branch-a",
      level: 0,
      isActive: true,
    },
  });

  console.log("✅ Organizations created");

  // ============================================
  // 6. OrganizationClosure の構築
  // ============================================
  console.log("🔗 Building organization closure table...");

  // ZenMao本社（ルート）
  await buildOrganizationClosure(zenmaoTenant.id, zenmaoHeadquarters.id, null);

  // ZenMao営業部（本社の子）
  await buildOrganizationClosure(zenmaoTenant.id, zenmaoSalesDept.id, zenmaoHeadquarters.id);

  // ZenMaoマーケティング部（本社の子）
  await buildOrganizationClosure(zenmaoTenant.id, zenmaoMarketingDept.id, zenmaoHeadquarters.id);

  // Partner支店A（ルート）
  await buildOrganizationClosure(partnerTenant.id, partnerBranchA.id, null);

  console.log("✅ Organization closure table built");

  // ============================================
  // 7. ユーザー (User) の作成
  // ============================================
  console.log("👤 Creating users...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // Master User: ZenMaoのSuper Admin
  const masterUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: zenmaoTenant.id,
        email: "admin@zenmao.com",
      },
    },
    update: {},
    create: {
      tenantId: zenmaoTenant.id,
      email: "admin@zenmao.com",
      passwordHash,
      name: "Master Admin",
      phoneNumber: "090-1234-5678",
      isActive: true,
      managerId: null, // 最上位管理者
    },
  });

  // Partner Admin: パートナー側の管理者
  const partnerAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: partnerTenant.id,
        email: "admin@partner.com",
      },
    },
    update: {},
    create: {
      tenantId: partnerTenant.id,
      email: "admin@partner.com",
      passwordHash,
      name: "Partner Admin",
      phoneNumber: "090-2345-6789",
      isActive: true,
      managerId: null,
    },
  });

  // General User: 一般社員
  const generalUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: zenmaoTenant.id,
        email: "user@zenmao.com",
      },
    },
    update: {},
    create: {
      tenantId: zenmaoTenant.id,
      email: "user@zenmao.com",
      passwordHash: await bcrypt.hash("password123", 10),
      name: "General User",
      phoneNumber: "090-3456-7890",
      isActive: true,
      managerId: masterUser.id, // Master Userの部下
    },
  });

  console.log("✅ Users created");

  // ============================================
  // 8. ユーザーと組織の紐付け (UserOrganization)
  // ============================================
  console.log("🔗 Linking users to organizations...");

  // Master Userを本社に所属（主所属）
  await prisma.userOrganization.upsert({
    where: {
      userId_organizationId: {
        userId: masterUser.id,
        organizationId: zenmaoHeadquarters.id,
      },
    },
    update: {},
    create: {
      userId: masterUser.id,
      organizationId: zenmaoHeadquarters.id,
      tenantId: zenmaoTenant.id,
      isPrimary: true,
      roleInOrg: "manager",
    },
  });

  // General Userを営業部に所属（主所属）
  await prisma.userOrganization.upsert({
    where: {
      userId_organizationId: {
        userId: generalUser.id,
        organizationId: zenmaoSalesDept.id,
      },
    },
    update: {},
    create: {
      userId: generalUser.id,
      organizationId: zenmaoSalesDept.id,
      tenantId: zenmaoTenant.id,
      isPrimary: true,
      roleInOrg: "member",
    },
  });

  // Partner Adminを支店Aに所属（主所属）
  await prisma.userOrganization.upsert({
    where: {
      userId_organizationId: {
        userId: partnerAdmin.id,
        organizationId: partnerBranchA.id,
      },
    },
    update: {},
    create: {
      userId: partnerAdmin.id,
      organizationId: partnerBranchA.id,
      tenantId: partnerTenant.id,
      isPrimary: true,
      roleInOrg: "manager",
    },
  });

  console.log("✅ Users linked to organizations");

  // ============================================
  // 9. ユーザーにロールを割り当て (UserRole)
  // ============================================
  console.log("🎭 Assigning roles to users...");

  // Master UserにSuper Adminロールを割り当て
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: masterUser.id,
        roleId: zenmaoSuperAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: masterUser.id,
      roleId: zenmaoSuperAdminRole.id,
      tenantId: zenmaoTenant.id,
      assignedBy: masterUser.id, // 自分で割り当て
      expiresAt: null, // 無期限
    },
  });

  // General UserにUserロールを割り当て
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: generalUser.id,
        roleId: zenmaoUserRole.id,
      },
    },
    update: {},
    create: {
      userId: generalUser.id,
      roleId: zenmaoUserRole.id,
      tenantId: zenmaoTenant.id,
      assignedBy: masterUser.id,
      expiresAt: null,
    },
  });

  // Partner AdminにSuper Adminロールを割り当て
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: partnerAdmin.id,
        roleId: partnerSuperAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: partnerAdmin.id,
      roleId: partnerSuperAdminRole.id,
      tenantId: partnerTenant.id,
      assignedBy: partnerAdmin.id,
      expiresAt: null,
    },
  });

  console.log("✅ Roles assigned to users");

  console.log("\n✨ Seed completed successfully!");
  console.log("\n📋 Summary:");
  console.log(`  - Tenants: 2 (ZenMao, Partner)`);
  console.log(`  - Permissions: ${Object.keys(permissions).length}`);
  console.log(`  - Roles: 5 (Super Admin x2, Org Admin, User x2)`);
  console.log(`  - Organizations: 4 (ZenMao: 3, Partner: 1)`);
  console.log(`  - Users: 3 (Master Admin, Partner Admin, General User)`);
  console.log("\n🔑 Login credentials:");
  console.log(`  - Master Admin: admin@zenmao.com / password123`);
  console.log(`  - Partner Admin: admin@partner.com / password123`);
  console.log(`  - General User: user@zenmao.com / password123`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

