import { Bell, BellRing, CheckCircle2, ChevronRight, PackageCheck, UsersRound } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { audiences } from '@/lib/audiences'
import { formatRelativeTime } from '@/lib/utils'
import { useAppStore } from '@/store'

export function NotificationCenter(): React.JSX.Element {
  const workspaceState = useAppStore((state) => state.workspaceState)
  const navigate = useAppStore((state) => state.navigate)
  const selectDocument = useAppStore((state) => state.selectDocument)
  const markUpdateRead = useAppStore((state) => state.markUpdateRead)
  const pending = workspaceState.notifications.filter((notification) => !notification.resolvedAt)
  const unread = pending.filter((notification) => !notification.readAt).length
  const latestDelivery = workspaceState.deliveries[0]

  const review = async (notificationId: string, documentId: string): Promise<void> => {
    await markUpdateRead(notificationId)
    selectDocument(documentId, false)
    navigate('sharing')
  }

  return <DropdownMenu.Root>
    <DropdownMenu.Trigger className="notification-trigger" aria-label={`Notifications, ${unread} unread`}>
      {unread ? <BellRing size={18} /> : <Bell size={18} />}
      {unread > 0 && <span>{unread > 9 ? '9+' : unread}</span>}
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className="notification-panel" align="end" sideOffset={8}>
        <div className="notification-head"><span><strong>Updates</strong><small>{pending.length ? `${pending.length} shared ${pending.length === 1 ? 'concept needs' : 'concepts need'} attention` : 'Shared knowledge is current'}</small></span>{unread > 0 && <em>{unread} new</em>}</div>
        <div className="notification-list">
          {pending.slice(0, 5).map((notification) => {
            const audienceNames = notification.audienceIds.map((id) => audiences.find((audience) => audience.id === id)?.name ?? id)
            return <DropdownMenu.Item key={notification.id} className={`notification-item ${notification.readAt ? '' : 'is-unread'}`} onSelect={() => void review(notification.id, notification.documentId)}>
              <span className="notification-icon"><BellRing size={16} /></span>
              <span><strong>{notification.documentTitle} changed</strong><small>{audienceNames.length ? `Previously shared with ${audienceNames.join(', ')}` : 'Previously included in a public share'}</small><time>{notification.updateMode === 'auto-prepare' ? 'Auto-prepare ready' : 'Review before redistributing'} · {formatRelativeTime(notification.detectedAt)}</time></span>
              <ChevronRight size={15} />
            </DropdownMenu.Item>
          })}
          {!pending.length && <div className="notification-empty"><CheckCircle2 size={22} /><strong>No stale shares</strong><small>You’ll be notified when shared content changes.</small></div>}
        </div>
        {latestDelivery && <div className="latest-delivery"><PackageCheck size={15} /><span><strong>{latestDelivery.name}</strong><small>{latestDelivery.documentIds.length} concepts exported {formatRelativeTime(latestDelivery.exportedAt)}</small></span></div>}
        <DropdownMenu.Item className="notification-footer" onSelect={() => navigate('sharing')}><UsersRound size={15} /> Open sharing & update queue <ChevronRight size={15} /></DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
}
