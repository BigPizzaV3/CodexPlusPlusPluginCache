import { z } from "zod";
export declare const pipelineStepSchema: z.ZodUnion<readonly [z.ZodObject<{
    trim: z.ZodObject<{
        start: z.ZodOptional<z.ZodNumber>;
        end: z.ZodOptional<z.ZodNumber>;
        duration: z.ZodOptional<z.ZodNumber>;
        mode: z.ZodOptional<z.ZodEnum<{
            auto: "auto";
            copy: "copy";
            accurate: "accurate";
        }>>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    speed: z.ZodObject<{
        factor: z.ZodNumber;
        audio: z.ZodOptional<z.ZodEnum<{
            sync: "sync";
            drop: "drop";
        }>>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    resize: z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
        fit: z.ZodOptional<z.ZodEnum<{
            contain: "contain";
            cover: "cover";
            stretch: "stretch";
        }>>;
        background: z.ZodOptional<z.ZodString>;
        profile: z.ZodOptional<z.ZodEnum<{
            balanced: "balanced";
            aggressive: "aggressive";
        }>>;
        fps: z.ZodOptional<z.ZodNumber>;
        crf: z.ZodOptional<z.ZodNumber>;
        preset: z.ZodOptional<z.ZodString>;
        to: z.ZodOptional<z.ZodEnum<{
            mp4: "mp4";
            webm: "webm";
        }>>;
        hardware: z.ZodOptional<z.ZodEnum<{
            nvenc: "nvenc";
            vaapi: "vaapi";
            qsv: "qsv";
            videotoolbox: "videotoolbox";
            auto: "auto";
            software: "software";
        }>>;
        hardwareDevice: z.ZodOptional<z.ZodString>;
        hardwareStrict: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    normalize: z.ZodObject<{
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        fps: z.ZodOptional<z.ZodNumber>;
        pixelFormat: z.ZodOptional<z.ZodString>;
        sampleRate: z.ZodOptional<z.ZodNumber>;
        channels: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    audio: z.ZodObject<{
        normalize: z.ZodLiteral<true>;
        sampleRate: z.ZodOptional<z.ZodNumber>;
        channels: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    convert: z.ZodObject<{
        to: z.ZodEnum<{
            mp4: "mp4";
            webm: "webm";
            aac: "aac";
            wav: "wav";
            mp3: "mp3";
            flac: "flac";
            gif: "gif";
            webp: "webp";
            png: "png";
            jpeg: "jpeg";
            m4a: "m4a";
            opus: "opus";
            ogg: "ogg";
        }>;
        fps: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        fit: z.ZodOptional<z.ZodEnum<{
            contain: "contain";
            cover: "cover";
            stretch: "stretch";
        }>>;
        background: z.ZodOptional<z.ZodString>;
        quality: z.ZodOptional<z.ZodNumber>;
        maxColors: z.ZodOptional<z.ZodNumber>;
        loop: z.ZodOptional<z.ZodNumber>;
        audioBitrate: z.ZodOptional<z.ZodString>;
        sampleRate: z.ZodOptional<z.ZodNumber>;
        channels: z.ZodOptional<z.ZodNumber>;
        hardware: z.ZodOptional<z.ZodEnum<{
            nvenc: "nvenc";
            vaapi: "vaapi";
            qsv: "qsv";
            videotoolbox: "videotoolbox";
            auto: "auto";
            software: "software";
        }>>;
        hardwareDevice: z.ZodOptional<z.ZodString>;
        hardwareStrict: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    preset: z.ZodString;
}, z.core.$strict>]>;
export declare const pipelineDocumentSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodLiteral<1>>;
    input: z.ZodString;
    presets: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        trim: z.ZodObject<{
            start: z.ZodOptional<z.ZodNumber>;
            end: z.ZodOptional<z.ZodNumber>;
            duration: z.ZodOptional<z.ZodNumber>;
            mode: z.ZodOptional<z.ZodEnum<{
                auto: "auto";
                copy: "copy";
                accurate: "accurate";
            }>>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        speed: z.ZodObject<{
            factor: z.ZodNumber;
            audio: z.ZodOptional<z.ZodEnum<{
                sync: "sync";
                drop: "drop";
            }>>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        resize: z.ZodObject<{
            width: z.ZodNumber;
            height: z.ZodNumber;
            fit: z.ZodOptional<z.ZodEnum<{
                contain: "contain";
                cover: "cover";
                stretch: "stretch";
            }>>;
            background: z.ZodOptional<z.ZodString>;
            profile: z.ZodOptional<z.ZodEnum<{
                balanced: "balanced";
                aggressive: "aggressive";
            }>>;
            fps: z.ZodOptional<z.ZodNumber>;
            crf: z.ZodOptional<z.ZodNumber>;
            preset: z.ZodOptional<z.ZodString>;
            to: z.ZodOptional<z.ZodEnum<{
                mp4: "mp4";
                webm: "webm";
            }>>;
            hardware: z.ZodOptional<z.ZodEnum<{
                nvenc: "nvenc";
                vaapi: "vaapi";
                qsv: "qsv";
                videotoolbox: "videotoolbox";
                auto: "auto";
                software: "software";
            }>>;
            hardwareDevice: z.ZodOptional<z.ZodString>;
            hardwareStrict: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        normalize: z.ZodObject<{
            width: z.ZodOptional<z.ZodNumber>;
            height: z.ZodOptional<z.ZodNumber>;
            fps: z.ZodOptional<z.ZodNumber>;
            pixelFormat: z.ZodOptional<z.ZodString>;
            sampleRate: z.ZodOptional<z.ZodNumber>;
            channels: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        audio: z.ZodObject<{
            normalize: z.ZodLiteral<true>;
            sampleRate: z.ZodOptional<z.ZodNumber>;
            channels: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        convert: z.ZodObject<{
            to: z.ZodEnum<{
                mp4: "mp4";
                webm: "webm";
                aac: "aac";
                wav: "wav";
                mp3: "mp3";
                flac: "flac";
                gif: "gif";
                webp: "webp";
                png: "png";
                jpeg: "jpeg";
                m4a: "m4a";
                opus: "opus";
                ogg: "ogg";
            }>;
            fps: z.ZodOptional<z.ZodNumber>;
            width: z.ZodOptional<z.ZodNumber>;
            height: z.ZodOptional<z.ZodNumber>;
            fit: z.ZodOptional<z.ZodEnum<{
                contain: "contain";
                cover: "cover";
                stretch: "stretch";
            }>>;
            background: z.ZodOptional<z.ZodString>;
            quality: z.ZodOptional<z.ZodNumber>;
            maxColors: z.ZodOptional<z.ZodNumber>;
            loop: z.ZodOptional<z.ZodNumber>;
            audioBitrate: z.ZodOptional<z.ZodString>;
            sampleRate: z.ZodOptional<z.ZodNumber>;
            channels: z.ZodOptional<z.ZodNumber>;
            hardware: z.ZodOptional<z.ZodEnum<{
                nvenc: "nvenc";
                vaapi: "vaapi";
                qsv: "qsv";
                videotoolbox: "videotoolbox";
                auto: "auto";
                software: "software";
            }>>;
            hardwareDevice: z.ZodOptional<z.ZodString>;
            hardwareStrict: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        preset: z.ZodString;
    }, z.core.$strict>]>>>>;
    steps: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        trim: z.ZodObject<{
            start: z.ZodOptional<z.ZodNumber>;
            end: z.ZodOptional<z.ZodNumber>;
            duration: z.ZodOptional<z.ZodNumber>;
            mode: z.ZodOptional<z.ZodEnum<{
                auto: "auto";
                copy: "copy";
                accurate: "accurate";
            }>>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        speed: z.ZodObject<{
            factor: z.ZodNumber;
            audio: z.ZodOptional<z.ZodEnum<{
                sync: "sync";
                drop: "drop";
            }>>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        resize: z.ZodObject<{
            width: z.ZodNumber;
            height: z.ZodNumber;
            fit: z.ZodOptional<z.ZodEnum<{
                contain: "contain";
                cover: "cover";
                stretch: "stretch";
            }>>;
            background: z.ZodOptional<z.ZodString>;
            profile: z.ZodOptional<z.ZodEnum<{
                balanced: "balanced";
                aggressive: "aggressive";
            }>>;
            fps: z.ZodOptional<z.ZodNumber>;
            crf: z.ZodOptional<z.ZodNumber>;
            preset: z.ZodOptional<z.ZodString>;
            to: z.ZodOptional<z.ZodEnum<{
                mp4: "mp4";
                webm: "webm";
            }>>;
            hardware: z.ZodOptional<z.ZodEnum<{
                nvenc: "nvenc";
                vaapi: "vaapi";
                qsv: "qsv";
                videotoolbox: "videotoolbox";
                auto: "auto";
                software: "software";
            }>>;
            hardwareDevice: z.ZodOptional<z.ZodString>;
            hardwareStrict: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        normalize: z.ZodObject<{
            width: z.ZodOptional<z.ZodNumber>;
            height: z.ZodOptional<z.ZodNumber>;
            fps: z.ZodOptional<z.ZodNumber>;
            pixelFormat: z.ZodOptional<z.ZodString>;
            sampleRate: z.ZodOptional<z.ZodNumber>;
            channels: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        audio: z.ZodObject<{
            normalize: z.ZodLiteral<true>;
            sampleRate: z.ZodOptional<z.ZodNumber>;
            channels: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        convert: z.ZodObject<{
            to: z.ZodEnum<{
                mp4: "mp4";
                webm: "webm";
                aac: "aac";
                wav: "wav";
                mp3: "mp3";
                flac: "flac";
                gif: "gif";
                webp: "webp";
                png: "png";
                jpeg: "jpeg";
                m4a: "m4a";
                opus: "opus";
                ogg: "ogg";
            }>;
            fps: z.ZodOptional<z.ZodNumber>;
            width: z.ZodOptional<z.ZodNumber>;
            height: z.ZodOptional<z.ZodNumber>;
            fit: z.ZodOptional<z.ZodEnum<{
                contain: "contain";
                cover: "cover";
                stretch: "stretch";
            }>>;
            background: z.ZodOptional<z.ZodString>;
            quality: z.ZodOptional<z.ZodNumber>;
            maxColors: z.ZodOptional<z.ZodNumber>;
            loop: z.ZodOptional<z.ZodNumber>;
            audioBitrate: z.ZodOptional<z.ZodString>;
            sampleRate: z.ZodOptional<z.ZodNumber>;
            channels: z.ZodOptional<z.ZodNumber>;
            hardware: z.ZodOptional<z.ZodEnum<{
                nvenc: "nvenc";
                vaapi: "vaapi";
                qsv: "qsv";
                videotoolbox: "videotoolbox";
                auto: "auto";
                software: "software";
            }>>;
            hardwareDevice: z.ZodOptional<z.ZodString>;
            hardwareStrict: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        preset: z.ZodString;
    }, z.core.$strict>]>>;
    output: z.ZodObject<{
        path: z.ZodString;
        codec: z.ZodOptional<z.ZodEnum<{
            h264: "h264";
            vp9: "vp9";
        }>>;
    }, z.core.$strict>;
}, z.core.$strict>;
//# sourceMappingURL=schema.d.ts.map