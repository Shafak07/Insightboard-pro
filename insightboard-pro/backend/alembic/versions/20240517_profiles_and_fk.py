"""Create profiles (auth sync) and datasets → profiles FK."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20240517_profiles"
down_revision = "20240516_datasets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE public.plan_type AS ENUM ('free', 'pro');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    if "profiles" not in insp.get_table_names(schema="public"):
        op.create_table(
            "profiles",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("email", sa.Text(), nullable=False),
            sa.Column("full_name", sa.Text(), nullable=True),
            sa.Column("avatar_url", sa.Text(), nullable=True),
            sa.Column(
                "plan",
                postgresql.ENUM("free", "pro", name="plan_type", create_type=False),
                nullable=False,
                server_default="free",
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(
                ["id"], ["auth.users.id"], ondelete="CASCADE", name="profiles_id_fkey"
            ),
        )
        op.create_index("profiles_email_idx", "profiles", ["email"])

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.handle_updated_at()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$;
        """
    )

    op.execute(
        """
        DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
        CREATE TRIGGER profiles_updated_at
          BEFORE UPDATE ON public.profiles
          FOR EACH ROW
          EXECUTE FUNCTION public.handle_updated_at();
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
          INSERT INTO public.profiles (id, email, full_name, avatar_url)
          VALUES (
            NEW.id,
            COALESCE(NEW.email, ''),
            COALESCE(
              NEW.raw_user_meta_data ->> 'full_name',
              NEW.raw_user_meta_data ->> 'name'
            ),
            NEW.raw_user_meta_data ->> 'avatar_url'
          )
          ON CONFLICT (id) DO NOTHING;
          RETURN NEW;
        END;
        $$;
        """
    )

    op.execute(
        """
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW
          EXECUTE FUNCTION public.handle_new_user();
        """
    )

    op.execute("ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY")

    op.execute(
        """
        DO $$ BEGIN
          CREATE POLICY "Users can view own profile"
            ON public.profiles FOR SELECT
            USING (auth.uid() = id);
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
          CREATE POLICY "Users can update own profile"
            ON public.profiles FOR UPDATE
            USING (auth.uid() = id)
            WITH CHECK (auth.uid() = id);
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    op.execute(
        """
        INSERT INTO public.profiles (id, email, full_name, avatar_url)
        SELECT
          u.id,
          COALESCE(u.email, ''),
          COALESCE(
            u.raw_user_meta_data ->> 'full_name',
            u.raw_user_meta_data ->> 'name'
          ),
          u.raw_user_meta_data ->> 'avatar_url'
        FROM auth.users u
        WHERE NOT EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = u.id
        );
        """
    )

    if "datasets" in insp.get_table_names(schema="public"):
        op.execute(
            """
            DO $$ BEGIN
                ALTER TABLE public.datasets
                ADD CONSTRAINT datasets_user_id_fkey
                FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE;
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
            """
        )


def downgrade() -> None:
    op.drop_constraint("datasets_user_id_fkey", "datasets", type_="foreignkey")
    op.execute("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users")
    op.execute("DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles")
    op.drop_index("profiles_email_idx", table_name="profiles")
    op.drop_table("profiles")
