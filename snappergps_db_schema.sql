--
-- PostgreSQL database dump
--

-- Dumped from database version 13.6 (Ubuntu 13.6-1.pgdg20.04+1+b1)
-- Dumped by pg_dump version 14.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: upload_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.upload_status AS ENUM (
    'uploading',
    'waiting',
    'processing',
    'complete'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.positions (
    position_id integer NOT NULL,
    snapshot_id integer,
    estimated_lat real,
    estimated_lng real,
    estimated_time_correction real,
    estimated_horizontal_error real
);


--
-- Name: positions_position_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.positions_position_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: positions_position_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.positions_position_id_seq OWNED BY public.positions.position_id;


--
-- Name: reference_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reference_points (
    reference_id integer NOT NULL,
    lat real,
    lng real,
    datetime timestamp(3) without time zone,
    upload_id character(10)
);


--
-- Name: reference_points_reference_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reference_points_reference_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reference_points_reference_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reference_points_reference_id_seq OWNED BY public.reference_points.reference_id;


--
-- Name: snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.snapshots (
    snapshot_id integer NOT NULL,
    upload_id character(10),
    datetime timestamp(3) without time zone,
    battery real,
    hxfo_count integer,
    lxfo_count integer,
    temperature real,
    data bytea
);


--
-- Name: snapshots_snapshot_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.snapshots_snapshot_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: snapshots_snapshot_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.snapshots_snapshot_id_seq OWNED BY public.snapshots.snapshot_id;


--
-- Name: uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uploads (
    upload_id character(10) NOT NULL,
    device_id character(16),
    status public.upload_status,
    earliest_processing_date timestamp without time zone,
    datetime timestamp(3) without time zone,
    email text,
    chat_id text,
    subscription json,
    max_velocity real,
    frequency_offset real
);


--
-- Name: positions position_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions ALTER COLUMN position_id SET DEFAULT nextval('public.positions_position_id_seq'::regclass);


--
-- Name: reference_points reference_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reference_points ALTER COLUMN reference_id SET DEFAULT nextval('public.reference_points_reference_id_seq'::regclass);


--
-- Name: snapshots snapshot_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshots ALTER COLUMN snapshot_id SET DEFAULT nextval('public.snapshots_snapshot_id_seq'::regclass);


--
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (position_id);


--
-- Name: reference_points reference_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reference_points
    ADD CONSTRAINT reference_points_pkey PRIMARY KEY (reference_id);


--
-- Name: snapshots snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshots
    ADD CONSTRAINT snapshots_pkey PRIMARY KEY (snapshot_id);


--
-- Name: uploads uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploads
    ADD CONSTRAINT uploads_pkey PRIMARY KEY (upload_id);


--
-- Name: positions fk_snapshot_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT fk_snapshot_id FOREIGN KEY (snapshot_id) REFERENCES public.snapshots(snapshot_id);


--
-- Name: reference_points fk_upload_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reference_points
    ADD CONSTRAINT fk_upload_id FOREIGN KEY (upload_id) REFERENCES public.uploads(upload_id) ON DELETE CASCADE;


--
-- Name: snapshots fk_upload_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snapshots
    ADD CONSTRAINT fk_upload_id FOREIGN KEY (upload_id) REFERENCES public.uploads(upload_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

