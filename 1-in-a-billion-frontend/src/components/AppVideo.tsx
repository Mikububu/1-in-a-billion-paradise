import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import {
    VideoView,
    useVideoPlayer,
    type VideoContentFit,
    type VideoSource,
} from 'expo-video';

type Props = {
    source: VideoSource;
    style?: StyleProp<ViewStyle>;
    contentFit?: VideoContentFit;
    shouldPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
    volume?: number; // 0..1
    playbackRate?: number;
    nativeControls?: boolean;
    onEnd?: () => void;
    onFirstFrame?: () => void;
};

export const AppVideo = ({
    source,
    style,
    contentFit = 'cover',
    shouldPlay = true,
    loop = false,
    muted = false,
    volume,
    playbackRate = 1,
    nativeControls = false,
    onEnd,
    onFirstFrame,
}: Props) => {
    const player = useVideoPlayer(source, (p) => {
        p.loop = !!loop;
        p.muted = !!muted;
        p.volume = typeof volume === 'number' ? volume : muted ? 0 : 1;
        p.playbackRate = playbackRate;
        // Avoid stepping on other audio unless we explicitly want to.
        p.audioMixingMode = 'auto';
        // We don't need time updates for these passive videos.
        p.timeUpdateEventInterval = 0;
        if (shouldPlay) p.play();
    });

    // Keep player properties in sync
    useEffect(() => {
        player.loop = !!loop;
        player.muted = !!muted;
        player.volume = typeof volume === 'number' ? volume : muted ? 0 : 1;
        player.playbackRate = playbackRate;
    }, [player, loop, muted, volume, playbackRate]);

    useEffect(() => {
        if (shouldPlay) player.play();
        else player.pause();
    }, [player, shouldPlay]);

    useEffect(() => {
        if (!onEnd) return;
        const sub = player.addListener('playToEnd', onEnd);
        return () => sub.remove();
    }, [player, onEnd]);

    return (
        <VideoView
            player={player}
            style={style}
            nativeControls={nativeControls}
            contentFit={contentFit}
            allowsVideoFrameAnalysis={false}
            onFirstFrameRender={onFirstFrame}
        />
    );
};
