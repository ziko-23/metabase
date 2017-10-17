import COSTS from 'metabase/xray/costs'

import {
    createAction,
    createThunkAction,
    handleActions
} from 'metabase/lib/redux'

import { XRayApi } from 'metabase/services'

export const INITIALIZE = 'metabase/xray/INITIALIZE'
export const initialize = createAction(INITIALIZE);

export const FETCH_XRAY = 'metabase/xray/FETCH_XRAY'
export const fetchXray = createThunkAction(
    FETCH_XRAY,
    (
        type: string,
        id: number,
        cost: string
    ) =>
    async (dispatch) => {
        dispatch(startLoad())
        try {
            const c = COSTS[cost]
            const xray = await XRayApi[`${type}_xray`]({
                [`${type}Id`]: id,
                ...c.method
            })
            dispatch(loadXray(xray))
        } catch (error) {
            console.error(error)
            dispatch(xrayError(error))
        }
    }
)


export const FETCH_COMPARISON = 'metabase/xray/FETCH_COMPARISON';
export const fetchComparison = createThunkAction(
    FETCH_COMPARISON,
    (endpoint, id1, id2, cost) =>
        async (dispatch) => {
            const c = COSTS[cost]
            dispatch(startLoad())
            try {
                const comparison = await endpoint({ id1, id2, ...c.method })
                return dispatch(loadComparison(comparison))
            } catch (error) {
                console.error(error)
                return dispatch(xrayError(error))
            }
        }
)

export const FETCH_SEGMENT_COMPARISON = 'metabase/xray/FETCH_SEGMENT_COMPARISON';
export const fetchSegmentComparison = (segmentId1, segmentId2, cost) =>
    async (dispatch) => {
        await dispatch(fetchComparison(XRayApi.segment_compare, segmentId1, segmentId2, cost))
        dispatch.action(FETCH_SEGMENT_COMPARISON)
    }

export const FETCH_SEGMENT_TABLE_COMPARISON = 'metabase/xray/FETCH_SEGMENT_TABLE_COMPARISON';
export const fetchSegmentTableComparison = (segmentId, tableId, cost) =>
    async (dispatch) => {
        await dispatch(fetchComparison(XRayApi.segment_table_compare, segmentId, tableId, cost))
        dispatch.action(FETCH_SEGMENT_TABLE_COMPARISON)
    }

export const FETCH_TABLE_COMPARISON = 'metabase/xray/FETCH_TABLE_COMPARISON';
export const fetchTableComparison = (tableId1, tableId2, cost) =>
    async (dispatch) => {
        await dispatch(fetchComparison(XRayApi.table_compare, tableId1, tableId2, cost))
        dispatch.action(FETCH_TABLE_COMPARISON)
    }

export const START_LOAD = 'metabase/xray/START_LOAD'
export const startLoad = createAction(START_LOAD)

export const LOAD_XRAY = 'metabase/xray/LOAD_XRAY'
export const loadXray = createAction(LOAD_XRAY)

export const LOAD_COMPARISON = 'metabase/xray/LOAD_COMPARISON'
export const loadComparison = createAction(LOAD_COMPARISON)

export const XRAY_ERROR = 'metabase/xray/XRAY_ERROR'
export const xrayError = createAction(XRAY_ERROR)

const CLEAN_STATE = {
    loading: false,
    error: null,
}

export default handleActions({
    [INITIALIZE]: () => CLEAN_STATE,
    [START_LOAD]: {
        next: (state, { payload }) => ({
            ...state,
            loading: true,
        })
    },
    [LOAD_XRAY]: {
        next: (state, { payload }) => ({
            ...state,
            xray: payload,
            loading: false
        })
    },
    [LOAD_COMPARISON]: {
        next: (state, { payload }) => ({
            ...state,
            comparison: payload,
            loading: false
        })
    },
    [XRAY_ERROR]: {
        next: (state, { payload }) => ({
            ...state,
            loading: false,
            error: payload
        })
    }
}, CLEAN_STATE)
