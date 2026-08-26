import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { NotificationType } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from './notifications.service';

interface DeadlineItem {
  id: string;
  kind: 'milestone' | 'task';
  title: string;
  dueAt: Date;
  projectId: string;
  projectTitle: string;
  recipientId: string;
  recipientEmail: string | null;
}

@Injectable()
export class DeadlineNotificationsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DeadlineNotificationsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    void this.run().catch((error) =>
      this.logger.error('Deadline notification scan failed', error),
    );
    this.timer = setInterval(
      () => {
        void this.run().catch((error) =>
          this.logger.error('Deadline notification scan failed', error),
        );
      },
      60 * 60 * 1000,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()): Promise<void> {
    const policy = await this.settings.notificationPolicy();
    if (
      !policy.deadlineReminder &&
      !policy.deadlineDue &&
      !policy.deadlineOverdue
    ) {
      return;
    }
    const reminderLimit = endOfUtcDay(
      new Date(now.getTime() + policy.reminderDays * 86_400_000),
    );
    const [tasks, milestones] = await Promise.all([
      this.prisma.projectTask.findMany({
        where: {
          dueAt: { not: null, lte: reminderLimit },
          status: { not: 'DONE' },
          owner: { userId: { not: null }, user: { status: 'ACTIVE' } },
        },
        include: {
          owner: { include: { user: true } },
          project: { include: { researchItem: true } },
        },
      }),
      this.prisma.projectMilestone.findMany({
        where: {
          dueAt: { not: null, lte: reminderLimit },
          status: { not: 'COMPLETE' },
          owner: { userId: { not: null }, user: { status: 'ACTIVE' } },
        },
        include: {
          owner: { include: { user: true } },
          project: { include: { researchItem: true } },
        },
      }),
    ]);

    const items: DeadlineItem[] = [
      ...tasks.flatMap((task) => {
        if (!task.dueAt || !task.owner?.user) return [];
        return [
          {
            id: task.id,
            kind: 'task' as const,
            title: task.title,
            dueAt: task.dueAt,
            projectId: task.projectId,
            projectTitle: task.project.researchItem.title ?? 'Project',
            recipientId: task.owner.user.id,
            recipientEmail: task.owner.user.email,
          },
        ];
      }),
      ...milestones.flatMap((milestone) => {
        if (!milestone.dueAt || !milestone.owner?.user) return [];
        return [
          {
            id: milestone.id,
            kind: 'milestone' as const,
            title: milestone.title,
            dueAt: milestone.dueAt,
            projectId: milestone.projectId,
            projectTitle: milestone.project.researchItem.title ?? 'Project',
            recipientId: milestone.owner.user.id,
            recipientEmail: milestone.owner.user.email,
          },
        ];
      }),
    ];
    await Promise.all(items.map((item) => this.notify(item, now, policy)));
  }

  private async notify(
    item: DeadlineItem,
    now: Date,
    policy: Awaited<ReturnType<SettingsService['notificationPolicy']>>,
  ): Promise<void> {
    const todayEnd = endOfUtcDay(now);
    const todayStart = startOfUtcDay(now);
    let event: 'due' | 'overdue' | 'reminder';
    let enabled: boolean;
    let type: NotificationType;
    if (item.dueAt < todayStart) {
      event = 'overdue';
      enabled = policy.deadlineOverdue;
      type = NotificationType.DEADLINE_OVERDUE;
    } else if (item.dueAt <= todayEnd) {
      event = 'due';
      enabled = policy.deadlineDue;
      type = NotificationType.DEADLINE_DUE;
    } else {
      event = 'reminder';
      enabled = policy.deadlineReminder;
      type = NotificationType.DEADLINE_REMINDER;
    }
    if (!enabled) return;

    const label = item.kind === 'task' ? 'Task' : 'Milestone';
    const title =
      event === 'due'
        ? `${label} due today`
        : event === 'overdue'
          ? `${label} overdue`
          : `${label} deadline approaching`;
    const due = item.dueAt.toLocaleDateString('en-GB', { timeZone: 'UTC' });
    const body = `${item.title} in ${item.projectTitle} is due ${due}.`;
    const uniqueKey = `deadline:${event}:${item.kind}:${item.id}:${item.dueAt.toISOString()}`;
    const created = await this.notifications.createOnce(
      item.recipientId,
      uniqueKey,
      {
        actionUrl: `/workspace/projects/${item.projectId}`,
        body,
        payload: { dueAt: item.dueAt.toISOString(), projectId: item.projectId },
        title,
        type,
      },
    );
    if (created && item.recipientEmail) {
      await this.mail.queue(
        { to: item.recipientEmail, subject: title, text: body },
        `${uniqueKey}:email`,
      );
    }
  }
}

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function endOfUtcDay(value: Date): Date {
  const start = startOfUtcDay(value);
  return new Date(start.getTime() + 86_400_000 - 1);
}
