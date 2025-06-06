'use client'
import type { FC, SVGProps } from 'react'
import React, { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useDebounce } from 'ahooks'
import { omit } from 'lodash-es'
import dayjs from 'dayjs'
import { basePath } from '@/utils/var'
import { Trans, useTranslation } from 'react-i18next'
import List from './list'
import Filter, { TIME_PERIOD_MAPPING } from './filter'
import Pagination from '@/app/components/base/pagination'
import Loading from '@/app/components/base/loading'
import { fetchChatConversations, fetchCompletionConversations } from '@/service/log'
import { APP_PAGE_LIMIT } from '@/config'
import type { App, AppMode } from '@/types/app'
export type ILogsProps = {
  appDetail: App
}

export type QueryParam = {
  period: string
  annotation_status?: string
  keyword?: string
  sort_by?: string
}

const ThreeDotsIcon = ({ className }: SVGProps<SVGElement>) => {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className ?? ''}>
    <path d="M5 6.5V5M8.93934 7.56066L10 6.5M10.0103 11.5H11.5103" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

const EmptyElement: FC<{ appUrl: string }> = ({ appUrl }) => {
  const { t } = useTranslation()
  const pathname = usePathname()
  const pathSegments = pathname.split('/')
  pathSegments.pop()
  return <div className='flex h-full items-center justify-center'>
    <div className='box-border h-fit w-[560px] rounded-2xl bg-background-section-burn px-5 py-4'>
      <span className='system-md-semibold text-text-secondary'>{t('appLog.table.empty.element.title')}<ThreeDotsIcon className='relative -left-1.5 -top-3 inline' /></span>
      <div className='system-sm-regular mt-2 text-text-tertiary'>
        <Trans
          i18nKey="appLog.table.empty.element.content"
          components={{ shareLink: <Link href={`${pathSegments.join('/')}/overview`} className='text-util-colors-blue-blue-600' />, testLink: <Link href={appUrl} className='text-util-colors-blue-blue-600' target='_blank' rel='noopener noreferrer' /> }}
        />
      </div>
    </div>
  </div>
}

const Logs: FC<ILogsProps> = ({ appDetail }) => {
  const { t } = useTranslation()
  const [queryParams, setQueryParams] = useState<QueryParam>({
    period: '2',
    annotation_status: 'all',
    sort_by: '-created_at',
  })
  const [currPage, setCurrPage] = React.useState<number>(0)
  const [limit, setLimit] = React.useState<number>(APP_PAGE_LIMIT)
  const debouncedQueryParams = useDebounce(queryParams, { wait: 500 })

  // Get the app type first
  const isChatMode = appDetail.mode !== 'completion'

  const query = {
    page: currPage + 1,
    limit,
    ...((debouncedQueryParams.period !== '9')
      ? {
        start: dayjs().subtract(TIME_PERIOD_MAPPING[debouncedQueryParams.period].value, 'day').startOf('day').format('YYYY-MM-DD HH:mm'),
        end: dayjs().endOf('day').format('YYYY-MM-DD HH:mm'),
      }
      : {}),
    ...(isChatMode ? { sort_by: debouncedQueryParams.sort_by } : {}),
    ...omit(debouncedQueryParams, ['period']),
  }

  const getWebAppType = (appType: AppMode) => {
    if (appType !== 'completion' && appType !== 'workflow')
      return 'chat'
    return appType
  }

  // When the details are obtained, proceed to the next request
  const { data: chatConversations, mutate: mutateChatList } = useSWR(() => isChatMode
    ? {
      url: `/apps/${appDetail.id}/chat-conversations`,
      params: query,
    }
    : null, fetchChatConversations)

  const { data: completionConversations, mutate: mutateCompletionList } = useSWR(() => !isChatMode
    ? {
      url: `/apps/${appDetail.id}/completion-conversations`,
      params: query,
    }
    : null, fetchCompletionConversations)

  const total = isChatMode ? chatConversations?.total : completionConversations?.total

  return (
    <div className='flex h-full grow flex-col'>
      <p className='system-sm-regular shrink-0 text-text-tertiary'>{t('appLog.description')}</p>
      <div className='flex max-h-[calc(100%-16px)] flex-1 grow flex-col py-4'>
        <Filter isChatMode={isChatMode} appId={appDetail.id} queryParams={queryParams} setQueryParams={setQueryParams} />
        {total === undefined
          ? <Loading type='app' />
          : total > 0
            ? <List logs={isChatMode ? chatConversations : completionConversations} appDetail={appDetail} onRefresh={isChatMode ? mutateChatList : mutateCompletionList} />
            : <EmptyElement appUrl={`${appDetail.site.app_base_url}${basePath}/${getWebAppType(appDetail.mode)}/${appDetail.site.access_token}`} />
        }
        {/* Show Pagination only if the total is more than the limit */}
        {(total && total > APP_PAGE_LIMIT)
          ? <Pagination
            current={currPage}
            onChange={setCurrPage}
            total={total}
            limit={limit}
            onLimitChange={setLimit}
          />
          : null}
      </div>
    </div>
  )
}

export default Logs
